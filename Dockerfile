# Use official Bun image
FROM oven/bun:1 AS base

# Set working directory
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock bunfig.toml ./
# Copy app package.json files for workspace dependencies (node_modules excluded via .dockerignore)
COPY apps ./apps
RUN bun install --frozen-lockfile

# Production stage
FROM base AS production

# Copy root files
COPY package.json bun.lock bunfig.toml tsconfig.json ./

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy apps with dependencies from deps stage
# (source code is same as build context, and includes installed node_modules)
COPY --from=deps /app/apps ./apps

# Create directories for data persistence
RUN mkdir -p .zodula_data .zodula_backup

# Expose port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Health check - check if server is responding
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD bun -e "try { const res = await fetch('http://localhost:3000/openapi'); process.exit(res.ok ? 0 : 1); } catch { process.exit(1); }"

# Start the server
CMD ["bun", "run", "apps/zodula/server/serve.tsx"]

