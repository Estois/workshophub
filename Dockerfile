FROM node:24-alpine AS base
RUN apk add --no-cache openssl
RUN npm install -g pnpm@9
WORKDIR /app

# ---- deps stage: install all dependencies ----
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY app/package.json ./app/
COPY api/package.json ./api/
RUN pnpm install --frozen-lockfile

# ---- build stage: compile TypeScript and Vite ----
FROM deps AS builder
COPY . .
RUN cd api && pnpm exec prisma generate
RUN pnpm --filter @workshophub/app build
RUN pnpm --filter @workshophub/api build
RUN mkdir -p api/database && \
    cd api && \
    DATABASE_URL="file:../database/workshophub.sqlite" pnpm exec prisma db push && \
    DATABASE_URL="file:../database/workshophub.sqlite" pnpm exec prisma db seed

# ---- runner stage: lean production image ----
FROM node:24-alpine AS runner
RUN apk add --no-cache openssl
RUN npm install -g pnpm@9
WORKDIR /app

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/api/package.json ./api/
COPY --from=builder /app/api/dist ./api/dist
COPY --from=builder /app/api/node_modules ./api/node_modules
COPY --from=builder /app/api/prisma ./api/prisma
COPY --from=builder /app/app/dist ./app/dist
COPY --from=builder /app/api/database ./api/database
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production

EXPOSE 8080

CMD ["./docker-entrypoint.sh"]
