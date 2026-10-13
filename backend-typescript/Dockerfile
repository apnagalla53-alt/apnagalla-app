FROM node:24-trixie-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM node:24-trixie-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY scripts/create-platform-admin.cjs scripts/reset-platform-password.cjs scripts/platform-mfa-reset.cjs scripts/run-backup.cjs ./scripts/
RUN mkdir -p /app/.local-backups /app/uploads && chown -R node:node /app/.local-backups /app/uploads
USER node
ENV NODE_ENV=production PORT=8010 UPLOAD_DIR=/app/uploads
EXPOSE 8010
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:8010/api/v1/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","dist/main"]
