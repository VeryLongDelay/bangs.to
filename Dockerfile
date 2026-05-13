FROM node:24-bookworm-slim AS builder

WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run codegen --from-merged && pnpm run build

FROM node:24-bookworm-slim

WORKDIR /app
RUN corepack enable
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/package.json package.json
COPY --from=builder /app/dist dist
COPY --from=builder /app/scripts scripts
COPY --from=builder /app/src/config src/config
COPY --from=builder /app/src/suggest.ts src/suggest.ts
COPY --from=builder /app/src/suggest-bang.ts src/suggest-bang.ts
COPY --from=builder /app/src/opensearch.ts src/opensearch.ts
COPY --from=builder /app/src/server src/server
COPY --from=builder /app/src/shared src/shared
COPY --from=builder /app/src/generated src/generated

ENV PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=2s --timeout=2s --start-period=2s --retries=5 CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["pnpm", "run", "start"]
