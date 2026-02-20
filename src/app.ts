import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerErrorHandler } from "./shared/errors/error.handler";
import { authRoutes } from "./modules/auth/auth.routes";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { jobsRoutes } from "./modules/jobs";

const app = Fastify({
  // logger: env.NODE_ENV === "development",
});

// Register plugins - MUST come before routes
app.register(fastifyCookie, {
  // secret: env.COOKIE_SECRET || 'my-secret', // optional, for cookie signing
  hook: "onRequest", // or 'preHandler'
});

// Register error handler
registerErrorHandler(app);

// Register routes
app.register(authRoutes, { prefix: "/api/auth" });
app.register(jobsRoutes, { prefix: "/api/jobs" });

// Health check
app.get("/health", async () => {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  };
});

// Start server
const start = async () => {
  try {
    await app.listen({
      port: env.PORT ? Number(env.PORT) : 3000,
      host: "0.0.0.0",
    });
    logger.info(`Server listening on port ${env.PORT || 3000}`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

start();
