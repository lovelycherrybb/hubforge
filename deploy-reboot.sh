#!/bin/bash
cd /opt/hubforge

# 停旧容器
docker stop hubforge-portal hubforge-nginx 2>/dev/null
docker rm hubforge-portal hubforge-nginx 2>/dev/null

# 写 docker-compose
cat > docker-compose.yml << 'COMPOSE'
services:
  postgres:
    image: postgres:16-alpine
    container_name: hubforge-db
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: hubforge
      POSTGRES_USER: hubforge
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-HubFor2026}
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./prisma/init.sql:/docker-entrypoint-initdb.d/01-init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hubforge -d hubforge"]
      interval: 10s
      timeout: 5s
      retries: 5

  portal:
    build: .
    container_name: hubforge-portal
    restart: unless-stopped
    environment:
      DATABASE_URL: "postgresql://hubforge:${POSTGRES_PASSWORD:-HubFor2026}@postgres:5432/hubforge?schema=public"
      JWT_SECRET: ${JWT_SECRET:-HubFor2026JWTSecret}
      COOKIE_NAME: hubforge-token
      NEXT_PUBLIC_APP_URL: https://cdthf.cn
      NODE_ENV: production
    expose:
      - "3000"
    depends_on:
      postgres:
        condition: service_healthy

  nginx:
    image: nginx:1.27-alpine
    container_name: hubforge-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - portal

volumes:
  pg_data:
COMPOSE

# 重建
docker compose up -d --build

# 等 portal 就绪
sleep 10

# 运行种子数据
docker exec hubforge-portal npx prisma db seed 2>&1 || echo "Seed failed, trying npx tsx..."

echo "=== 容器状态 ==="
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
echo "=== 健康检查 ==="
curl -sk https://localhost/api/health -H 'Host: cdthf.cn'
