FROM node:20-alpine

WORKDIR /app

# Fix SSL issue
RUN npm config set strict-ssl false

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps --ignore-scripts

# Copy project
COPY . .

# Build Next.js
RUN npx next build

EXPOSE 3000

# ✅ IMPORTANT FIX
CMD ["node", ".next/standalone/server.js"]