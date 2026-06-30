FROM node:22-slim AS builder

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 build-essential && \
    rm -rf /var/lib/apt/lists/*

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY src/ ./src/
COPY tsconfig.json ./

FROM node:22-slim

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg ca-certificates procps python3 && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./

RUN node -e "require('youtube-dl-exec').update().then(() => console.log('yt-dlp updated'))"
RUN mkdir -p /app/storage

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD pgrep -f "tsx src/main.ts" >/dev/null || exit 1

CMD ["npx", "tsx", "src/main.ts"]
