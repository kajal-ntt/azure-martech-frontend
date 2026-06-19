# ─────────────────────────────────────────────
# Stage 1: Build
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Fix SSL issues on corporate networks
RUN npm config set strict-ssl false

COPY package*.json ./
RUN npm install --legacy-peer-deps --ignore-scripts

COPY . .

# Build Next.js (standalone output, configured in next.config.ts)
RUN npx next build

# ─────────────────────────────────────────────
# Stage 2: Runtime (small, production-only)
# ─────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Copy the standalone server + minimal node_modules it needs
COPY --from=builder /app/.next/standalone ./
# Copy static assets (standalone build does NOT include these automatically)
COPY --from=builder /app/.next/static ./.next/static
# Copy public assets (ffmpeg wasm files etc.)
COPY --from=builder /app/public ./public

EXPOSE 3000

# server.js lands directly in /app after copying standalone's contents
CMD ["node", "server.js"]