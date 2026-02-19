import { FastifyRequest, FastifyReply } from "fastify";
import { AuthUtils } from "./auth.utils";
import {
  ForbiddenError,
  UnauthorizedError,
} from "../../shared/errors/http.errors";

export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply,
) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError("No token provided");
    }

    const token = authHeader.substring(7); // Remove "Bearer "
    const decoded = AuthUtils.verifyAccessToken(token);

    // Attach user to request
    request.user = decoded;
  } catch (error) {
    throw new UnauthorizedError("Invalid or expired token");
  }
}

export function authorize(...allowedRoles: string[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedError("User not authenticated");
    }

    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenError("Insufficient permissions");
    }
  };
}

// Optional: Optional auth (doesn't throw if no token)
export async function optionalAuthenticate(
  request: FastifyRequest,
  _reply: FastifyReply,
) {
  try {
    const authHeader = request.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const decoded = AuthUtils.verifyAccessToken(token);
      request.user = decoded;
    }
  } catch (error) {
    // Silently fail - user remains undefined
  }
}
