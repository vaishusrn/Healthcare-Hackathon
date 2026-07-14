# --- Frontend build: compile the Vite/React SPA into static assets ---
FROM oven/bun:1.3.11-alpine AS frontend

WORKDIR /app/frontend

# Install with dev deps (vite/tsc/plugins) — needed to build.
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile

COPY frontend/ ./
RUN bun run build
# Output: /app/frontend/dist

# --- Backend dependencies: production-only node_modules ---
FROM oven/bun:1.3.11-alpine AS dependencies

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# --- Runtime: single server hosting the SPA at / and the API at /v1 ---
FROM oven/bun:1.3.11-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DB_FILE_NAME=/data/healthcare.sqlite
ENV FRONTEND_DIR=/app/public

RUN mkdir -p /data && chown -R bun:bun /data /app

COPY --from=dependencies --chown=bun:bun /app/node_modules ./node_modules
COPY --chown=bun:bun package.json bun.lock ./
COPY --chown=bun:bun src ./src
# Built frontend served as static files at / (see src/static.ts).
COPY --from=frontend --chown=bun:bun /app/frontend/dist ./public

USER bun

EXPOSE 3000
VOLUME ["/data"]

CMD ["bun", "src/index.ts"]
