import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import fastifyCors from "@fastify/cors";
import path from "path";
import { registerErrorHandler } from "./shared/errors/error.handler";
import { authRoutes } from "./modules/auth/auth.routes";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { jobsRoutes } from "./modules/jobs";
import { RealtimeService } from "./services/realtime.service";

const app = Fastify({
  logger: env.NODE_ENV === "development",
});

// Initialize Realtime Service with Fastify's server
const realtimeService = new RealtimeService(app.server);

// Decorate app with realtime service
app.decorate("realtime", realtimeService);

// Register CORS - THIS MUST COME FIRST
app.register(fastifyCors, {
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  // Let Fastify handle OPTIONS automatically
});

// Serve static files
app.register(fastifyStatic, {
  root: path.join(__dirname, "../public"),
  prefix: "/",
  decorateReply: true,
});

// Register plugins
app.register(fastifyCookie, {
  hook: "onRequest",
});

// Register error handler
registerErrorHandler(app);

// Register routes
app.register(authRoutes, { prefix: "/api/auth" });
app.register(jobsRoutes, { prefix: "/api/jobs" });

// Health check
app.get("/health", async (_request, _reply) => {
  const stats = realtimeService.getStats();

  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    websocket: {
      active: true,
      connections: stats.connections,
      users: stats.users,
    },
  };
});

// Start server
const start = async () => {
  try {
    await app.listen({
      port: env.PORT ? Number(env.PORT) : 8080,
      host: "0.0.0.0",
    });

    const address = app.server.address();
    const port = typeof address === "string" ? 8080 : address?.port;

    logger.info(`🚀 Server listening on port ${port}`);
    logger.info(`📡 WebSocket server ready at ws://localhost:${port}`);
    logger.info(`📍 Health check: http://localhost:${port}/health`);
    logger.info(`🌐 Dashboard: http://localhost:${port}/index.html`);
    logger.info(`🔓 CORS enabled for all origins`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

start();

// Extend Fastify types
declare module "fastify" {
  interface FastifyInstance {
    realtime: RealtimeService;
  }
}
