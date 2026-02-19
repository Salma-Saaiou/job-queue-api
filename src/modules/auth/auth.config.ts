import { env } from "../../config/env";

export const authConfig = {
  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET || "fallback-access-secret",
    refreshSecret: env.JWT_REFRESH_SECRET || "fallback-refresh-secret",
    accessExpiry: env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshExpiry: env.JWT_REFRESH_EXPIRES_IN || "7d",
  },
  bcrypt: {
    saltRounds: env.BCRYPT_ROUNDS || 10,
  },
  cookie: {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  },
};
