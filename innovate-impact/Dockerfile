# Base image is pulled from Microsoft Container Registry (MCR) instead of
# Docker Hub to avoid anonymous Docker Hub pull rate limits hitting the shared
# ACR build agent IPs. Azure Linux 3.0 node:20 image is roughly equivalent to
# the official node:20 (Debian-based) image.
ARG BASE_IMAGE=mcr.microsoft.com/azurelinux/base/nodejs:20

# --- deps ---
FROM ${BASE_IMAGE} AS deps
WORKDIR /app
RUN tdnf install -y openssl ca-certificates && tdnf clean all
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install --no-audit --no-fund

# --- build ---
FROM ${BASE_IMAGE} AS builder
WORKDIR /app
RUN tdnf install -y openssl ca-certificates && tdnf clean all
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Dummy DATABASE_URL so Next.js page-data collection can import API routes that
# build a Prisma client at module load. Real DATABASE_URL is injected at runtime.
ENV DATABASE_URL=postgresql://build@localhost:5432/build?sslmode=disable
RUN npx prisma generate
RUN npm run build

# --- runtime ---
FROM ${BASE_IMAGE} AS runner
WORKDIR /app
RUN tdnf install -y openssl ca-certificates wget && tdnf clean all
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# DATABASE_URL (postgres + Entra auth) and AZURE_CLIENT_ID are injected by the
# Container App at runtime. start.js fetches an Entra token for `prisma db push`
# and then hands off to Next.js (which uses @prisma/adapter-pg with token refresh).

# Standalone Next.js output + full node_modules (start.js, seed.js, and
# the driver-adapter Prisma client require pg / @prisma/adapter-pg /
# @azure/identity, which Next.js's trace does not pick up because those
# scripts run outside the Next.js server entrypoint).
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/start.js ./start.js
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src/lib/prompts ./src/lib/prompts

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# Fetch an Entra token, run prisma db push, seed, then start Next.js.
CMD ["node", "start.js"]
