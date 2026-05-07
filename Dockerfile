FROM oven/bun:latest AS builder

WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run codegen --from-merged && bun run build

FROM oven/bun:latest

WORKDIR /app
COPY --from=builder /app/dist dist
COPY --from=builder /app/scripts/start.ts scripts/start.ts
COPY --from=builder /app/src/config src/config
COPY --from=builder /app/src/suggest.ts src/suggest.ts
COPY --from=builder /app/src/suggest-bang.ts src/suggest-bang.ts
COPY --from=builder /app/src/opensearch.ts src/opensearch.ts
COPY --from=builder /app/src/server src/server
COPY --from=builder /app/src/shared src/shared
COPY --from=builder /app/src/generated src/generated

ENV PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=2s --timeout=2s --start-period=2s --retries=5 CMD bun -e "fetch('http://127.0.0.1:' + process.env.PORT + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["bun", "scripts/start.ts"]
