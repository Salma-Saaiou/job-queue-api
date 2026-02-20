import { PrismaClient, JobStatus, Job } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  CreateJobInput,
  UpdateJobInput,
  JobResponse,
  JobAttemptResponse,
} from "./jobs.types";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../shared/errors/http.errors";

export class JobsService {
  constructor(private prisma: PrismaClient) {}

  // Create a new job
  async createJob(userId: string, data: CreateJobInput): Promise<JobResponse> {
    const job = await this.prisma.job.create({
      data: {
        type: data.type,
        payload: data.payload,
        priority: data.priority || 0,
        scheduledFor: data.scheduledFor
          ? new Date(data.scheduledFor)
          : undefined,
        maxAttempts: data.maxAttempts || 3,
        createdBy: userId,
      },
    });

    return this.formatJobResponse(job);
  }

  // Get a single job by ID
  async getJobById(jobId: string, userId?: string): Promise<JobResponse> {
    const where: any = { id: jobId };

    // If userId provided, ensure job belongs to user (for non-admin)
    if (userId) {
      where.createdBy = userId;
    }

    const job = await this.prisma.job.findFirst({
      where,
      include: {
        jobAttempts: {
          orderBy: { attemptNumber: "desc" },
        },
      },
    });

    if (!job) {
      throw new NotFoundError("Job not found");
    }

    return this.formatJobResponse(job);
  }

  // Get jobs with filtering
  async getJobs(
    query: any,
    userId?: string,
  ): Promise<{ jobs: JobResponse[]; total: number }> {
    const where: any = {};

    if (userId) {
      where.createdBy = userId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.type) {
      where.type = query.type;
    }

    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        skip: query.offset || 0,
        take: query.limit || 50,
        include: {
          jobAttempts: {
            take: 1,
            orderBy: { attemptNumber: "desc" },
          },
        },
      }),
      this.prisma.job.count({ where }),
    ]);

    return {
      jobs: jobs.map((job) => this.formatJobResponse(job)),
      total,
    };
  }

  // Update job (admin only typically)
  async updateJob(jobId: string, data: UpdateJobInput): Promise<JobResponse> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundError("Job not found");
    }

    const updatedJob = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: data.status,
        priority: data.priority,
      },
    });

    return this.formatJobResponse(updatedJob);
  }

  // Cancel a job
  async cancelJob(jobId: string, userId: string): Promise<JobResponse> {
    const job = await this.prisma.job.findFirst({
      where: {
        id: jobId,
        createdBy: userId,
      },
    });

    if (!job) {
      throw new NotFoundError("Job not found");
    }

    if (job.status === JobStatus.COMPLETED) {
      throw new BadRequestError("Cannot cancel completed job");
    }

    if (job.status === JobStatus.CANCELLED) {
      throw new ConflictError("Job already cancelled");
    }

    const cancelledJob = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.CANCELLED,
      },
    });

    return this.formatJobResponse(cancelledJob);
  }

  // Get job attempts history
  async getJobAttempts(
    jobId: string,
    userId: string,
  ): Promise<JobAttemptResponse[]> {
    const job = await this.prisma.job.findFirst({
      where: {
        id: jobId,
        createdBy: userId,
      },
    });

    if (!job) {
      throw new NotFoundError("Job not found");
    }

    const attempts = await this.prisma.jobAttempt.findMany({
      where: { jobId },
      orderBy: { attemptNumber: "asc" },
    });

    return attempts.map((attempt) => ({
      id: attempt.id,
      attemptNumber: attempt.attemptNumber,
      startedAt: attempt.startedAt,
      finishedAt: attempt.finishedAt,
      error: attempt.error,
    }));
  }

  // Worker methods (internal use)
  async claimNextJob(workerId: string): Promise<JobResponse | null> {
    // Use transaction with row-level locking to prevent race conditions
    const job = await this.prisma.$transaction(
      async (tx) => {
        // Find next available job with row-level locking
        const nextJob = await tx.$queryRaw`
        SELECT * FROM jobs
        WHERE status = 'PENDING'
          AND (scheduled_for IS NULL OR scheduled_for <= NOW())
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `;

        if (!nextJob || !Array.isArray(nextJob) || nextJob.length === 0) {
          return null;
        }

        const job = nextJob[0] as Job;

        // Update job status
        const updatedJob = await tx.job.update({
          where: { id: job.id },
          data: {
            status: JobStatus.PROCESSING,
            workerId,
            startedAt: new Date(),
            attempts: {
              increment: 1,
            },
          },
        });

        // Create attempt record
        await tx.jobAttempt.create({
          data: {
            jobId: job.id,
            attemptNumber: updatedJob.attempts,
            startedAt: new Date(),
          },
        });

        return updatedJob;
      },
      {
        isolationLevel: "Serializable", // Ensures consistent locking
      },
    );

    return job ? this.formatJobResponse(job) : null;
  }

  // Mark job as completed
  async completeJob(
    jobId: string,
    workerId: string,
    result: any,
  ): Promise<JobResponse> {
    const job = await this.prisma.job.findFirst({
      where: {
        id: jobId,
        workerId,
        status: JobStatus.PROCESSING,
      },
    });

    if (!job) {
      throw new NotFoundError("Job not found or not assigned to this worker");
    }

    const completedJob = await this.prisma.$transaction(async (tx) => {
      // Update job
      const updated = await tx.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.COMPLETED,
          completedAt: new Date(),
          result,
        },
      });

      // Update attempt
      await tx.jobAttempt.updateMany({
        where: {
          jobId,
          attemptNumber: updated.attempts,
        },
        data: {
          finishedAt: new Date(),
        },
      });

      return updated;
    });

    return this.formatJobResponse(completedJob);
  }

  // Mark job as failed with retry logic
  async failJob(
    jobId: string,
    workerId: string,
    error: string,
  ): Promise<JobResponse> {
    const job = await this.prisma.job.findFirst({
      where: {
        id: jobId,
        workerId,
        status: JobStatus.PROCESSING,
      },
    });

    if (!job) {
      throw new NotFoundError("Job not found or not assigned to this worker");
    }

    const failedJob = await this.prisma.$transaction(async (tx) => {
      // Update attempt with error
      await tx.jobAttempt.updateMany({
        where: {
          jobId,
          attemptNumber: job.attempts,
        },
        data: {
          finishedAt: new Date(),
          error,
        },
      });

      // Check if max attempts reached
      const nextStatus =
        job.attempts >= job.maxAttempts ? JobStatus.DEAD : JobStatus.FAILED;

      // Calculate next retry with exponential backoff
      const backoffDelay = Math.pow(2, job.attempts) * 1000; // 2^attempts seconds
      const scheduledFor =
        nextStatus === JobStatus.FAILED
          ? new Date(Date.now() + backoffDelay)
          : null;

      // Update job
      const updated = await tx.job.update({
        where: { id: jobId },
        data: {
          status: nextStatus,
          error,
          scheduledFor,
          workerId: null, // Release worker
        },
      });

      return updated;
    });

    return this.formatJobResponse(failedJob);
  }

  // Retry a dead job (admin only)
  async retryDeadJob(jobId: string): Promise<JobResponse> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundError("Job not found");
    }

    if (job.status !== JobStatus.DEAD) {
      throw new BadRequestError("Only dead jobs can be retried");
    }

    const retriedJob = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.PENDING,
        error: null,
        attempts: 0, // Reset attempts
        workerId: null,
        scheduledFor: new Date(), // Run immediately
      },
    });

    return this.formatJobResponse(retriedJob);
  }

  // Get queue statistics
  async getQueueStats(userId?: string) {
    const where = userId ? { createdBy: userId } : {};

    const stats = await this.prisma.$transaction([
      this.prisma.job.count({ where: { ...where, status: JobStatus.PENDING } }),
      this.prisma.job.count({
        where: { ...where, status: JobStatus.PROCESSING },
      }),
      this.prisma.job.count({
        where: { ...where, status: JobStatus.COMPLETED },
      }),
      this.prisma.job.count({ where: { ...where, status: JobStatus.FAILED } }),
      this.prisma.job.count({ where: { ...where, status: JobStatus.DEAD } }),
      this.prisma.job.count({
        where: { ...where, status: JobStatus.CANCELLED },
      }),

      // Get average priority instead of dates
      this.prisma.job.aggregate({
        where: { ...where },
        _avg: {
          priority: true,
          attempts: true,
        },
      }),
    ]);

    // Calculate average processing time manually
    const completedJobs = await this.prisma.job.findMany({
      where: {
        ...where,
        status: JobStatus.COMPLETED,
        startedAt: { not: null },
        completedAt: { not: null },
      },
      select: {
        startedAt: true,
        completedAt: true,
      },
    });

    let avgProcessingTime = null;
    if (completedJobs.length > 0) {
      const totalTime = completedJobs.reduce((sum, job) => {
        const start = job.startedAt!.getTime();
        const end = job.completedAt!.getTime();
        return sum + (end - start);
      }, 0);
      avgProcessingTime = totalTime / completedJobs.length; // in milliseconds
    }

    return {
      pending: stats[0],
      processing: stats[1],
      completed: stats[2],
      failed: stats[3],
      dead: stats[4],
      cancelled: stats[5],
      averagePriority: stats[6]._avg.priority || 0,
      averageAttempts: stats[6]._avg.attempts || 0,
      averageProcessingTime: avgProcessingTime, // in ms
      totalJobs:
        stats[0] + stats[1] + stats[2] + stats[3] + stats[4] + stats[5],
    };
  }

  private formatJobResponse(job: any): JobResponse {
    return {
      id: job.id,
      type: job.type,
      payload: job.payload,
      status: job.status,
      priority: job.priority,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      error: job.error,
      result: job.result,
      scheduledFor: job.scheduledFor,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdAt: job.createdAt,
      createdBy: job.createdBy,
    };
  }
}

export const jobsService = new JobsService(prisma);
