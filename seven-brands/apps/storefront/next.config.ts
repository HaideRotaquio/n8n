import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import path from "node:path";

// Load the monorepo root .env so every app shares one config file in development.
const rootEnv = path.resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Our pages are never framed; Paddle's checkout frames its own domain inside ours, which this allows.
  { key: "X-Frame-Options", value: "DENY" },
];

const config: NextConfig = {
  poweredByHeader: false,
  // Self-contained server for containers (see infrastructure/Dockerfile); traced from the monorepo root.
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  transpilePackages: ["@sb/core", "@sb/db", "@sb/auth", "@sb/storage", "@sb/ui", "@sb/asset", "@sb/commerce", "@sb/brands"],
  serverExternalPackages: ["pg"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Account and checkout pages are private.
      { source: "/(account|checkout|sign-in|sign-up)(.*)", headers: [{ key: "X-Robots-Tag", value: "noindex" }, { key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
};

export default config;
