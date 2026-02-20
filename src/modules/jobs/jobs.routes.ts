import { FastifyInstance } from "fastify";
import { jobsController } from "./jobs.controller";
import { authenticate, authorize } from "../auth/auth.middleware";

export async function jobsRoutes(fastify: FastifyInstance) {
  // All job routes require authentication
  fastify.addHook("preHandler", authenticate);

  // Create a job
  fastify.post("/", jobsController.createJob.bind(jobsController));

  // Get all jobs (with filters)
  fastify.get("/", jobsController.getJobs.bind(jobsController));

  // Get queue statistics
  fastify.get("/stats", jobsController.getQueueStats.bind(jobsController));

  // Get job by ID
  fastify.get("/:id", jobsController.getJobById.bind(jobsController));

  // Get job attempts
  fastify.get(
    "/:id/attempts",
    jobsController.getJobAttempts.bind(jobsController),
  );

  // Cancel a job
  fastify.patch("/:id/cancel", jobsController.cancelJob.bind(jobsController));

  // Admin only routes
  fastify.patch("/:id", {
    preHandler: [authorize("ADMIN")],
    handler: jobsController.updateJob.bind(jobsController),
  });

  fastify.post("/:id/retry", {
    preHandler: [authorize("ADMIN")],
    handler: jobsController.retryDeadJob.bind(jobsController),
  });
}
