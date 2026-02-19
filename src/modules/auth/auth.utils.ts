import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { authConfig } from "./auth.config";
import { JWTPayload } from "./auth.types";
import { InternalError } from "../../shared/errors/http.errors";

export class AuthUtils {
  // Password hashing
  static async hashPassword(password: string): Promise<string> {
    try {
      return await bcrypt.hash(password, authConfig.bcrypt.saltRounds);
    } catch (error) {
      throw new InternalError("Error hashing password");
    }
  }

  // Password comparison
  static async comparePasswords(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      throw new InternalError("Error comparing passwords");
    }
  }

  // Generate access token
  static generateAccessToken(payload: JWTPayload): string {
    try {
      return jwt.sign(payload, authConfig.jwt.accessSecret, {
        expiresIn: authConfig.jwt.accessExpiry as jwt.SignOptions["expiresIn"],
      });
    } catch (error) {
      throw new InternalError("Error generating access token");
    }
  }

  // Generate refresh token
  static generateRefreshToken(payload: JWTPayload): string {
    try {
      return jwt.sign(payload, authConfig.jwt.refreshSecret, {
        expiresIn: authConfig.jwt.refreshExpiry as jwt.SignOptions["expiresIn"],
      });
    } catch (error) {
      throw new InternalError("Error generating refresh token");
    }
  }

  // Verify access token
  static verifyAccessToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, authConfig.jwt.accessSecret) as JWTPayload;
    } catch (error) {
      throw new InternalError("Invalid or expired access token");
    }
  }

  // Verify refresh token
  static verifyRefreshToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, authConfig.jwt.refreshSecret) as JWTPayload;
    } catch (error) {
      throw new InternalError("Invalid or expired refresh token");
    }
  }
}
