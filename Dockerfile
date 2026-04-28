FROM node:25-bookworm-slim AS deps

WORKDIR /app
RUN npm install -g bun@1.3.9
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install

FROM node:25-bookworm-slim AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm install -g bun@1.3.9 && bun run build

FROM node:25-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl git python3 util-linux docker-cli docker-compose \
  && rm -rf /var/lib/apt/lists/*

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
