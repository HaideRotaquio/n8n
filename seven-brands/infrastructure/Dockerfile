# Seven Brands — production images (staging and later live).
# Build from the seven-brands/ folder:
#   docker build -f infrastructure/Dockerfile --target storefront -t sb-storefront .
#   docker build -f infrastructure/Dockerfile --target admin      -t sb-admin .
#   docker build -f infrastructure/Dockerfile --target worker     -t sb-worker .
# Next.js apps run as standalone servers; the worker needs ffmpeg. No secrets are baked into images.

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY services ./services
COPY brands ./brands
RUN pnpm install --frozen-lockfile

FROM deps AS build-admin
RUN pnpm --filter @sb/admin build

FROM deps AS build-storefront
RUN pnpm --filter @sb/storefront build

FROM node:22-bookworm-slim AS admin
ENV NODE_ENV=production PORT=3100 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build-admin /repo/apps/admin/.next/standalone ./
COPY --from=build-admin /repo/apps/admin/.next/static ./apps/admin/.next/static
USER node
EXPOSE 3100
CMD ["node", "apps/admin/server.js"]

FROM node:22-bookworm-slim AS storefront
ENV NODE_ENV=production PORT=3200 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build-storefront /repo/apps/storefront/.next/standalone ./
COPY --from=build-storefront /repo/apps/storefront/.next/static ./apps/storefront/.next/static
USER node
EXPOSE 3200
CMD ["node", "apps/storefront/server.js"]

# Worker and one-off tasks (migrations, seed, create-owner) share this image.
FROM deps AS worker
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
USER node
WORKDIR /repo/services/worker
CMD ["node", "--import", "tsx", "src/main.ts"]
