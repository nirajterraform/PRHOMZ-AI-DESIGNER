# Build context expected: repo root (so we can COPY both api/ and shared/)
# Build with: docker build -f api/Dockerfile -t prhomz-api .
# Or via gcloud: gcloud builds submit --tag <tag> --config=api/cloudbuild.yaml .

FROM node:20-slim AS builder
WORKDIR /build

COPY api/package*.json ./
RUN npm ci --include=dev

COPY api/tsconfig.json ./
COPY api/src ./src
COPY shared ./src/_shared

RUN npx tsc

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# fontconfig + a default font for sharp's watermark text rendering.
# Without these, sharp logs "Fontconfig error: Cannot load default config
# file" and watermark text renders as empty rectangles.
RUN apt-get update \
  && apt-get install -y --no-install-recommends fontconfig fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*

COPY api/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /build/lib ./lib

EXPOSE 8080

RUN groupadd --system app && useradd --system --gid app app
USER app

CMD ["node", "lib/index.js"]
