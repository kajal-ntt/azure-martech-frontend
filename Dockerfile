# ─────────────────────────────────────────────
# Stage 1: Build
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
 
# Fix SSL issues on corporate networks
RUN npm config set strict-ssl false
 
COPY package*.json ./
RUN npm install --legacy-peer-deps --ignore-scripts
 
# Declare build args BEFORE COPY . . so cache busts correctly
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_APP_URL
ARG BUILD_ID=0
 
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
 
# Forces a fresh build when BUILD_ID changes
RUN echo "Build ID: $BUILD_ID"
 
COPY . .
 
# Build Next.js (standalone output configured in next.config.ts)
RUN npx next build
 
# ─────────────────────────────────────────────
# Stage 2: Runtime (small, production-only)
# ─────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
 
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
 
# Copy standalone server + minimal node_modules
COPY --from=builder /app/.next/standalone ./
# Copy static assets (NOT included in standalone automatically)
COPY --from=builder /app/.next/static ./.next/static
# Copy public assets
COPY --from=builder /app/public ./public
 
EXPOSE 3000
 
CMD ["node", "server.js"]