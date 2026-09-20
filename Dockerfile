FROM node:20-alpine AS base

# ── Dependencies ────────────────────────────────────────────
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ── Build ───────────────────────────────────────────────────
# No secrets are baked in here: the app reads DATABASE_URL and AUTH_SECRET when
# it starts, so the image can be built once and configured per machine.
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── Tools ───────────────────────────────────────────────────
# One-shot jobs that run before the app: apply migrations, create the owner.
# Kept out of the runtime image because they need drizzle-kit and tsx.
FROM builder AS tools
ENV NODE_ENV=production
CMD ["sh", "-c", "npx drizzle-kit migrate && npx tsx src/db/bootstrap.ts"]

# ── Runner ──────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
