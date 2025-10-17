FROM node:18-bullseye-slim AS builder
WORKDIR /app

# Install build dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 build-essential ca-certificates libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies and build
COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --production

FROM node:18-bullseye-slim AS runtime
WORKDIR /app

# create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser \
    && mkdir -p /app/data && chown -R appuser:appuser /app /app/data

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

USER appuser
ENV NODE_ENV=production
EXPOSE 8000
CMD ["npm", "start"]