# --- Stage 1: Build ---
# [THAY ĐỔI 1] Đổi từ alpine sang slim để mạng ổn định hơn
FROM node:22-slim AS builder

# [THAY ĐỔI 2] Cài thêm OpenSSL (Prisma trên Debian/Slim cần cái này)
RUN apt-get update -y && apt-get install -y openssl

# Enable pnpm
RUN corepack enable

WORKDIR /app

# Copy package.json & lockfile
COPY package.json pnpm-lock.yaml ./

# Cài full dependencies
RUN pnpm install --frozen-lockfile

# Copy Prisma schema
COPY prisma ./prisma

# Generate Prisma client
RUN pnpm exec prisma generate

# Copy source code
COPY . .

# Build NestJS
RUN pnpm run build

# Compile seed.ts
RUN pnpm exec tsc --project tsconfig.seed.json


# --- Stage 2: Run ---
# [THAY ĐỔI 1] Đổi từ alpine sang slim
FROM node:22-slim

# [THAY ĐỔI 2] Cài OpenSSL cho môi trường chạy
RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app
RUN corepack enable

# Copy node_modules prod
COPY --from=builder /app/node_modules ./node_modules

# Copy Prisma folder
COPY --from=builder /app/prisma ./prisma

# Copy NestJS dist
COPY --from=builder /app/dist ./dist

# Copy package.json
COPY --from=builder /app/package.json ./package.json

EXPOSE 3001

# CMD giữ nguyên logic fix lỗi tìm file trước đó, thêm seed vào giữa
CMD ["sh", "-c", "npx prisma migrate deploy && (node dist/main.js || node dist/src/main.js)"]