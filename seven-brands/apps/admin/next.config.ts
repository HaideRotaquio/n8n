import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import path from "node:path";

// Load the monorepo root .env so every app shares one config file in development.
const rootEnv = path.resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const config: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ["@sb/core", "@sb/db", "@sb/auth", "@sb/brands", "@sb/storage", "@sb/ui", "@sb/asset", "@sb/audio", "@sb/player", "@sb/rigs", "@sb/agents"],
  serverExternalPackages: ["pg", "@anthropic-ai/sdk"],
  experimental: { authInterrupts: true },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default config;
