# Coforma Studio - Multi-stage Dockerfile for Turborepo monorepo
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc tsconfig.json ./
COPY packages/ ./packages/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client (packages/types re-exports @prisma/client types)
RUN cd packages/api && npx prisma generate || true

# Build all packages
ENV NEXT_TELEMETRY_DISABLED=1
# Build only the web package and its dependencies (not api which has unresolved deps)
RUN pnpm build --filter=@coforma/web...

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application (adjust path based on actual app structure)
COPY --from=builder /app/packages/web/.next/standalone ./
COPY --from=builder /app/packages/web/.next/static ./packages/web/.next/static
COPY --from=builder /app/packages/web/public ./packages/web/public

USER nextjs

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "packages/web/server.js"]
