import { jobsService } from "./jobs.service";
import { logger } from "../../config/logger";

export interface WorkerOptions {
  workerId: string;
  pollInterval?: number; // ms
  maxConcurrent?: number;
  handlers: Map<string, (payload: any) => Promise<any>>;
}

export class JobWorker {
  private workerId: string;
  private pollInterval: number;
  private maxConcurrent: number;
  private handlers: Map<string, (payload: any) => Promise<any>>;
  private isRunning: boolean = false;
  private activeJobs: Set<string> = new Set();

  constructor(options: WorkerOptions) {
    this.workerId = options.workerId;
    this.pollInterval = options.pollInterval || 5000; // Default 5 seconds
    this.maxConcurrent = options.maxConcurrent || 5;
    this.handlers = options.handlers;
  }

  // Start the worker
  async start() {
    this.isRunning = true;
    logger.info(`🚀 Worker ${this.workerId} started`);

    while (this.isRunning) {
      try {
        await this.poll();
      } catch (error) {
        logger.error(
          { error, workerId: this.workerId },
          "Error in worker poll",
        );
      }

      // Wait before next poll
      await this.sleep(this.pollInterval);
    }
  }

  // Stop the worker
  async stop() {
    this.isRunning = false;
    logger.info(`🛑 Worker ${this.workerId} stopped`);

    // Wait for active jobs to complete
    while (this.activeJobs.size > 0) {
      logger.info(`⏳ Waiting for ${this.activeJobs.size} jobs to complete...`);
      await this.sleep(1000);
    }
  }

  // Poll for new jobs
  private async poll() {
    // Check if we can take more jobs
    const availableSlots = this.maxConcurrent - this.activeJobs.size;

    if (availableSlots <= 0) {
      logger.debug(
        `Worker ${this.workerId} at max capacity (${this.activeJobs.size}/${this.maxConcurrent})`,
      );
      return;
    }

    logger.debug(`Worker ${this.workerId} polling for jobs...`);

    // Claim next job
    const job = await jobsService.claimNextJob(this.workerId);

    if (!job) {
      logger.debug(`No jobs available for worker ${this.workerId}`);
      return;
    }

    logger.info(
      `📦 Worker ${this.workerId} claimed job ${job.id} of type ${job.type}`,
    );

    // Process job
    this.activeJobs.add(job.id);
    this.processJob(job).finally(() => {
      this.activeJobs.delete(job.id);
    });
  }

  // Process a single job
  private async processJob(job: any) {
    try {
      // Find handler for this job type
      const handler = this.handlers.get(job.type);

      if (!handler) {
        throw new Error(`No handler registered for job type: ${job.type}`);
      }

      logger.info(`⚙️ Worker ${this.workerId} processing job ${job.id}`);

      // Execute job handler
      const result = await handler(job.payload);

      // Mark as completed
      await jobsService.completeJob(job.id, this.workerId, result);

      logger.info(`✅ Worker ${this.workerId} completed job ${job.id}`);
    } catch (error) {
      // Mark as failed
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      await jobsService.failJob(job.id, this.workerId, errorMessage);

      logger.error(
        { error, jobId: job.id },
        `❌ Worker ${this.workerId} failed job ${job.id}`,
      );
    }
  }

  // Utility sleep function
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
