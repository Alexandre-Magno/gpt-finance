# Dockerfile for Frontend (Next.js) - build de producao
FROM node:18-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci


FROM node:18-alpine AS builder

WORKDIR /app

# rewrites() e avaliado durante o `next build` e serializado em
# .next/routes-manifest.json -- o servidor nao o reavalia no start. Por isso
# BACKEND_URL tem que estar presente aqui, e nao apenas em runtime.
ARG BACKEND_URL=http://backend:8000
ENV BACKEND_URL=$BACKEND_URL
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Descarta as devDependencies: o runner so precisa das de producao.
RUN npm prune --omit=dev


FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
# next.config.mjs e lido em runtime: e nele que os rewrites de /api/* para
# BACKEND_URL sao resolvidos quando o servidor sobe.
COPY --from=builder /app/next.config.mjs ./next.config.mjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:3000/', r => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["npm", "run", "start"]
