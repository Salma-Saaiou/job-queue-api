import { FastifyInstance } from "fastify";
import { authController } from "./auth.controller";
import { authenticate, authorize } from "./auth.middleware";

export async function authRoutes(fastify: FastifyInstance) {
  // Public routes
  fastify.post("/register", authController.register.bind(authController));
  fastify.post("/login", authController.login.bind(authController));
  fastify.post(
    "/refresh-token",
    authController.refreshToken.bind(authController),
  );
  fastify.post("/logout", authController.logout.bind(authController));

  // Protected routes
  fastify.get("/me", {
    preHandler: [authenticate],
    handler: authController.getMe.bind(authController),
  });

  fastify.post("/logout-all", {
    preHandler: [authenticate],
    handler: authController.logoutAll.bind(authController),
  });

  // Admin only route example
  fastify.get("/users", {
    preHandler: [authenticate, authorize("ADMIN")],
    handler: async (_request, reply) => {
      const { prisma } = await import("../../config/database");
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      });

      return reply.send({
        success: true,
        data: users,
      });
    },
  });
}
