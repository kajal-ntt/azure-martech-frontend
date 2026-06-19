FROM node:20-alpine

WORKDIR /app

# 🔥 Fix SSL issue
RUN npm config set strict-ssl false

COPY package*.json ./

RUN npm install --legacy-peer-deps --ignore-scripts

COPY . .

# Build
RUN npx next build

EXPOSE 3000

CMD ["npx", "next", "start"]