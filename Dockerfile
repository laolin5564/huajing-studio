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
ARG TARGETARCH
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl git python3 util-linux \
  && rm -rf /var/lib/apt/lists/* \
  && case "${TARGETARCH:-amd64}" in \
    amd64) docker_arch="x86_64"; compose_arch="x86_64" ;; \
    arm64) docker_arch="aarch64"; compose_arch="aarch64" ;; \
    *) echo "unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; \
  esac \
  && curl -fsSL "https://download.docker.com/linux/static/stable/${docker_arch}/docker-28.5.2.tgz" \
    | tar -xz -C /tmp docker/docker \
  && mv /tmp/docker/docker /usr/local/bin/docker \
  && mkdir -p /usr/local/lib/docker/cli-plugins \
  && curl -fsSL "https://github.com/docker/compose/releases/download/v2.40.3/docker-compose-linux-${compose_arch}" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose \
  && chmod +x /usr/local/bin/docker /usr/local/lib/docker/cli-plugins/docker-compose

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
