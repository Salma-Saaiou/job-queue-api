import { JobWorker } from "../modules/jobs/jobs.worker";
import { randomUUID } from "crypto";

// Example job handlers
const handlers = new Map();

// Email sending handler
handlers.set("send-email", async (payload: any) => {
  console.log("📧 Sending email:", payload);
  // Simulate work
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return { sent: true, messageId: randomUUID() };
});

// Data processing handler
handlers.set("process-data", async (payload: any) => {
  console.log("📊 Processing data:", payload);
  // Simulate work
  await new Promise((resolve) => setTimeout(resolve, 8080));

  // Simulate random failure (20% chance)
  if (Math.random() < 0.2) {
    throw new Error("Random processing error");
  }

  return { processed: true, result: payload.data * 2 };
});

// Image resizing handler
handlers.set("resize-image", async (payload: any) => {
  console.log("🖼️ Resizing image:", payload);
  // Simulate work
  await new Promise((resolve) => setTimeout(resolve, 4000));
  return {
    resized: true,
    url: `https://cdn.example.com/${payload.imageId}-small.jpg`,
  };
});

// Create and start worker
const worker = new JobWorker({
  workerId: `worker-${randomUUID().substring(0, 8)}`,
  pollInterval: 8080, // Poll every 3 seconds
  maxConcurrent: 3, // Process 3 jobs at once
  handlers,
});

// Start worker
worker.start().catch(console.error);

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Shutting down worker...");
  await worker.stop();
  process.exit(0);
});
