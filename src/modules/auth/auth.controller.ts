import { FastifyRequest, FastifyReply } from "fastify";
import { authService } from "./auth.service";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  RegisterInput,
  LoginInput,
} from "./auth.types";
import { authConfig } from "./auth.config";
import { BadRequestError } from "../../shared/errors/http.errors";

export class AuthController {
  async register(request: FastifyRequest, reply: FastifyReply) {
    const data = registerSchema.parse(request.body) as RegisterInput;
    const result = await authService.register(data);

    this.setRefreshTokenCookie(reply, result.tokens.refreshToken);

    return reply.status(201).send({
      success: true,
      data: {
        user: result.user,
        accessToken: result.tokens.accessToken,
      },
    });
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    const data = loginSchema.parse(request.body) as LoginInput;
    const result = await authService.login(data);

    this.setRefreshTokenCookie(reply, result.tokens.refreshToken);

    return reply.send({
      success: true,
      data: {
        user: result.user,
        accessToken: result.tokens.accessToken,
      },
    });
  }

  async refreshToken(request: FastifyRequest, reply: FastifyReply) {
    const data = refreshTokenSchema.parse({
      refreshToken: request.cookies.refreshToken || request.body,
    });

    if (!data.refreshToken) {
      throw new BadRequestError("Refresh token required");
    }

    const tokens = await authService.refreshToken(data.refreshToken);

    this.setRefreshTokenCookie(reply, tokens.refreshToken);

    return reply.send({
      success: true,
      data: {
        accessToken: tokens.accessToken,
      },
    });
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    const refreshToken = request.cookies.refreshToken;

    if (refreshToken) {
      await authService.logout(refreshToken);
    }

    reply.clearCookie("refreshToken");

    return reply.send({
      success: true,
      message: "Logged out successfully",
    });
  }

  async logoutAll(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user!.userId;
    await authService.logoutAll(userId);

    reply.clearCookie("refreshToken");

    return reply.send({
      success: true,
      message: "Logged out from all devices",
    });
  }

  async getMe(request: FastifyRequest, reply: FastifyReply) {
    console.log(request.user);
    const userId = request.user!.userId;
    const user = await authService.getUserById(userId);

    return reply.send({
      success: true,
      data: { user },
    });
  }

  private setRefreshTokenCookie(reply: FastifyReply, refreshToken: string) {
    reply.setCookie("refreshToken", refreshToken, authConfig.cookie);
  }
}

export const authController = new AuthController();
