FROM docker:28-cli AS dockercli

FROM oven/bun:1.3.9 AS bunbin

FROM node:25-bookworm-slim AS bunbase

COPY --from=bunbin /usr/local/bin/bun /usr/local/bin/bun

FROM bunbase AS deps

WORKDIR /app
COPY package.deps.json ./package.json
COPY bun.lock* ./
RUN bun install --frozen-lockfile || bun install

FROM bunbase AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM node:25-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=dockercli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=dockercli /usr/local/libexec/docker/cli-plugins/docker-compose /usr/local/lib/docker/cli-plugins/docker-compose

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/workers ./workers
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts

RUN mkdir -p /app/data/images

EXPOSE 3000

CMD ["sh", "-c", "node_modules/.bin/next start -p ${PORT:-3000} & node --import tsx workers/image-worker.ts"]
