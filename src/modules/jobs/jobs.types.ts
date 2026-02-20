import { z } from "zod";
import { JobStatus } from "@prisma/client";

// Validation schemas
export const createJobSchema = z.object({
  type: z.string().min(1, "Job type is required"),
  payload: z.record(z.string(), z.any()), // JSON object
  priority: z.number().min(0).max(100).default(0),
  scheduledFor: z.string().datetime().optional(),
  maxAttempts: z.number().min(1).max(10).default(3),
});

export const updateJobSchema = z.object({
  status: z.enum(JobStatus).optional(),
  priority: z.number().min(0).max(100).optional(),
});

export const jobIdSchema = z.object({
  id: z.string().uuid("Invalid job ID format"),
});

export const jobQuerySchema = z.object({
  status: z.enum(JobStatus).optional(),
  type: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

// Types
export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type JobIdInput = z.infer<typeof jobIdSchema>;
export type JobQueryInput = z.infer<typeof jobQuerySchema>;

// Response types
export interface JobResponse {
  id: string;
  type: string;
  payload: any;
  status: JobStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  error?: string | null;
  result?: any | null;
  scheduledFor?: Date | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
  createdBy: string;
}

export interface JobAttemptResponse {
  id: string;
  attemptNumber: number;
  startedAt: Date;
  finishedAt?: Date | null;
  error?: string | null;
}
