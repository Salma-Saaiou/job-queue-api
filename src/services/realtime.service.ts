import { Server as SocketServer } from "socket.io";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { logger } from "../config/logger";
import { env } from "../config/env";

interface RealtimeStats {
  connections: number;
  rooms: number;
  users: number;
}

export class RealtimeService {
  private io: SocketServer;
  private userSockets: Map<string, Set<string>> = new Map();
  private connectionCount: number = 0;

  constructor(server: HttpServer) {
    this.io = new SocketServer(server, {
      cors: {
        origin: "*", // Allow all origins
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      },
      transports: ["websocket", "polling"],
      allowEIO3: true,
      pingTimeout: 60000,
      pingInterval: 25000,
      connectTimeout: 45000,
      allowRequest: (_req, callback) => {
        callback(null, true);
      },
    });

    this.setupMiddleware();
    this.setupHandlers();
    logger.info("📡 WebSocket server initialized");
  }

  private setupMiddleware() {
    this.io.use((socket, next) => {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.token ||
        socket.handshake.query.token;

      if (!token) {
        logger.warn("WebSocket connection attempted without token");
        return next(new Error("Authentication required"));
      }

      try {
        const tokenString = Array.isArray(token) ? token[0] : token;
        const decoded = jwt.verify(tokenString, env.JWT_ACCESS_SECRET!);
        socket.data.user = decoded;
        logger.info(`✅ WebSocket authenticated: ${(decoded as any).userId}`);
        next();
      } catch (error) {
        console.log(error);
        logger.warn("WebSocket authentication failed:");
        next(new Error("Invalid token"));
      }
    });
  }

  private setupHandlers() {
    this.io.on("connection", (socket) => {
      const userId = (socket.data.user as any).userId;
      this.connectionCount++;

      logger.info(
        `🔌 Client connected: ${userId} (Total: ${this.connectionCount})`,
      );

      // Track user's sockets
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(socket.id);

      // Join user to their private room
      socket.join(`user:${userId}`);

      // Handle subscriptions
      socket.on("subscribe:jobs", () => {
        socket.join(`jobs:${userId}`);
        socket.emit("subscribed", { room: "jobs", userId });
      });

      socket.on("subscribe:stats", () => {
        if ((socket.data.user as any).role === "ADMIN") {
          socket.join("stats:global");
          socket.emit("subscribed", { room: "stats:global", userId });
        }
      });

      // Handle disconnection
      socket.on("disconnect", (reason) => {
        this.connectionCount--;
        this.userSockets.get(userId)?.delete(socket.id);

        if (this.userSockets.get(userId)?.size === 0) {
          this.userSockets.delete(userId);
        }

        logger.info(
          `🔌 Client disconnected: ${userId} (Reason: ${reason}) (Total: ${this.connectionCount})`,
        );
      });

      // Handle errors
      socket.on("error", (error) => {
        console.log(error);
        logger.error(`Socket error for user ${userId}:`);
      });

      // Send initial connection confirmation
      socket.emit("connected", {
        userId,
        timestamp: new Date().toISOString(),
        connections: this.connectionCount,
      });
    });
  }

  // Emit job update to specific user
  emitJobUpdate(userId: string, job: any) {
    this.io.to(`user:${userId}`).emit("job:updated", {
      type: "JOB_UPDATED",
      data: job,
      timestamp: new Date().toISOString(),
    });
  }

  // Emit new job to user
  emitNewJob(userId: string, job: any) {
    this.io.to(`user:${userId}`).emit("job:created", {
      type: "JOB_CREATED",
      data: job,
      timestamp: new Date().toISOString(),
    });
  }

  // Emit stats update (to admin dashboards)
  emitStatsUpdate(stats: any) {
    this.io.to("stats:global").emit("stats:updated", {
      type: "STATS_UPDATED",
      data: stats,
      timestamp: new Date().toISOString(),
    });
  }

  // Get realtime stats
  getStats(): RealtimeStats {
    return {
      connections: this.connectionCount,
      rooms: this.io?.sockets?.adapter?.rooms?.size || 0,
      users: this.userSockets.size,
    };
  }

  // Close all connections
  async close() {
    logger.info("Closing WebSocket server...");
    await this.io.close();
  }
}
