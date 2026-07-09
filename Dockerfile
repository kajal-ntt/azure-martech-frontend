# -------------------------------
# Stage 1: Build
# -------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

RUN npm config set strict-ssl false

COPY package*.json ./
RUN npm install --legacy-peer-deps --ignore-scripts

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_APP_URL
ARG BUILD_ID=0

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN echo "Build ID: $BUILD_ID"

COPY . .

RUN npm run build

# -------------------------------
# Stage 2: Runtime
# -------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./

EXPOSE 3000

CMD ["node", "server.js"]