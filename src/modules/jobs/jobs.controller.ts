import { FastifyRequest, FastifyReply } from "fastify";
import { jobsService } from "./jobs.service";
import {
  createJobSchema,
  updateJobSchema,
  jobIdSchema,
  jobQuerySchema,
  CreateJobInput,
  UpdateJobInput,
  JobIdInput,
  JobQueryInput,
} from "./jobs.types";
import { UnauthorizedError } from "../../shared/errors/http.errors";

export class JobsController {
  // Create a new job
  async createJob(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user?.userId;
    if (!userId) {
      throw new UnauthorizedError("User not authenticated");
    }

    const data = createJobSchema.parse(request.body) as CreateJobInput;
    const job = await jobsService.createJob(userId, data);

    return reply.status(201).send({
      success: true,
      data: job,
    });
  }

  // Get job by ID
  async getJobById(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user?.userId;
    const isAdmin = request.user?.role === "ADMIN";

    const { id } = jobIdSchema.parse(request.params) as JobIdInput;

    // Admins can view any job, users can only view their own
    const job = await jobsService.getJobById(id, isAdmin ? undefined : userId);

    return reply.send({
      success: true,
      data: job,
    });
  }

  // Get all jobs with filters
  async getJobs(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user?.userId;
    const isAdmin = request.user?.role === "ADMIN";

    const query = jobQuerySchema.parse(request.query) as JobQueryInput;

    const result = await jobsService.getJobs(
      query,
      isAdmin ? undefined : userId, // Admins see all, users see only their own
    );

    return reply.send({
      success: true,
      data: result.jobs,
      meta: {
        total: result.total,
        limit: query.limit,
        offset: query.offset,
      },
    });
  }

  // Update job (admin only)
  async updateJob(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== "ADMIN") {
      throw new UnauthorizedError("Admin access required");
    }

    const { id } = jobIdSchema.parse(request.params) as JobIdInput;
    const data = updateJobSchema.parse(request.body) as UpdateJobInput;

    const job = await jobsService.updateJob(id, data);

    return reply.send({
      success: true,
      data: job,
    });
  }

  // Cancel a job
  async cancelJob(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user?.userId;
    if (!userId) {
      throw new UnauthorizedError("User not authenticated");
    }

    const { id } = jobIdSchema.parse(request.params) as JobIdInput;
    const job = await jobsService.cancelJob(id, userId);

    return reply.send({
      success: true,
      data: job,
    });
  }

  // Get job attempts history
  async getJobAttempts(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user?.userId;
    if (!userId) {
      throw new UnauthorizedError("User not authenticated");
    }

    const { id } = jobIdSchema.parse(request.params) as JobIdInput;
    const attempts = await jobsService.getJobAttempts(id, userId);

    return reply.send({
      success: true,
      data: attempts,
    });
  }

  // Retry a dead job (admin only)
  async retryDeadJob(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== "ADMIN") {
      throw new UnauthorizedError("Admin access required");
    }

    const { id } = jobIdSchema.parse(request.params) as JobIdInput;
    const job = await jobsService.retryDeadJob(id);

    return reply.send({
      success: true,
      data: job,
    });
  }

  // Get queue statistics
  async getQueueStats(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user?.userId;
    const isAdmin = request.user?.role === "ADMIN";

    const stats = await jobsService.getQueueStats(isAdmin ? undefined : userId);

    return reply.send({
      success: true,
      data: stats,
    });
  }
}

export const jobsController = new JobsController();
