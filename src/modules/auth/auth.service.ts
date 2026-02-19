import { PrismaClient } from "@prisma/client";
import { prisma } from "../../config/database";
import { AuthUtils } from "./auth.utils";
import {
  RegisterInput,
  LoginInput,
  AuthResponse,
  AuthTokens,
  JWTPayload,
} from "./auth.types";
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from "../../shared/errors/http.errors";

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  async register(data: RegisterInput): Promise<AuthResponse> {
    const { email, password, name } = data;

    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestError("User with this email already exists");
    }

    // Hash password
    const hashedPassword = await AuthUtils.hashPassword(password);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    // Generate tokens
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const tokens = await this.generateTokens(payload);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      tokens,
    };
  }

  async login(data: LoginInput): Promise<AuthResponse> {
    const { email, password } = data;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    // Verify password
    const isValidPassword = await AuthUtils.comparePasswords(
      password,
      user.password,
    );

    if (!isValidPassword) {
      throw new UnauthorizedError("Invalid email or password");
    }

    // Generate tokens
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const tokens = await this.generateTokens(payload);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      tokens,
    };
  }

  async refreshToken(oldRefreshToken: string): Promise<AuthTokens> {
    // Verify refresh token
    const payload = AuthUtils.verifyRefreshToken(oldRefreshToken);

    // Check if token exists in database
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: oldRefreshToken },
    });

    if (!storedToken) {
      throw new UnauthorizedError("Invalid refresh token");
    }

    // Delete old refresh token
    await this.prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });

    // Generate new tokens
    return this.generateTokens({
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    });
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  private async generateTokens(payload: JWTPayload): Promise<AuthTokens> {
    const accessToken = AuthUtils.generateAccessToken(payload);
    const refreshToken = AuthUtils.generateRefreshToken(payload);

    // Store refresh token in database
    await this.prisma.refreshToken.create({
      data: {
        userId: payload.userId,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    return user;
  }
}

export const authService = new AuthService(prisma);
