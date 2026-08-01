#!/bin/bash
# ============================================================
# HubForge 部署脚本
# 用法: bash deploy.sh
# 功能: 构建镜像 → 部署 → 健康检查 → 清理旧镜像
# ============================================================
set -e

PROJECT_DIR="/opt/hubforge"
IMAGE_NAME="hubforge-portal"
VERSION=$(date +%Y%m%d-%H%M)
KEEP_VERSIONS=2

cd "$PROJECT_DIR"

echo "=========================================="
echo " HubForge 部署 - $VERSION"
echo "=========================================="

# 1. 构建新镜像
echo ""
echo "[1/5] 构建镜像 $IMAGE_NAME:$VERSION ..."
docker build -t "$IMAGE_NAME:$VERSION" -t "$IMAGE_NAME:latest" . 2>&1 | tail -5
SIZE=$(docker images "$IMAGE_NAME:$VERSION" --format '{{.Size}}')
echo "✅ 镜像构建完成: $IMAGE_NAME:$VERSION ($SIZE)"

# 2. 重启 Portal
echo ""
echo "[2/5] 重启 Portal ..."
docker stop hubforge-portal 2>/dev/null || true
docker rm hubforge-portal 2>/dev/null || true

DB_PASS=$(docker exec hubforge-db printenv POSTGRES_PASSWORD 2>/dev/null || echo "postgres")

docker run -d \
  --name hubforge-portal \
  --network hubforge_default \
  --alias portal \
  --restart unless-stopped \
  -e "DATABASE_URL=postgresql://hubforge:***@postgres:5432/hubforge?schema=public" \
  -e "JWT_SECRET=HubFor2026JWTSecret" \
  -e "COOKIE_NAME=hubforge-token" \
  -e "NEXT_PUBLIC_APP_URL=https://cdthf.cn" \
  -e "NODE_ENV=production" \
  -p 3001:3000 \
  "$IMAGE_NAME:latest"

# 3. 更新巡检应用静态文件
echo ""
echo "[3/5] 更新巡检应用静态文件 ..."
if docker ps --format '{{.Names}}' | grep -q vc-inspection; then
  docker cp vc-inspection:/app/static "$PROJECT_DIR/vc-static" 2>/dev/null
  chmod -R 644 "$PROJECT_DIR/vc-static/js/"* "$PROJECT_DIR/vc-static/css/"* 2>/dev/null
  echo "✅ 静态文件已更新"
fi

# 4. 健康检查
echo ""
echo "[4/5] 健康检查 ..."
sleep 8
HEALTH=$(curl -sk --max-time 5 https://localhost/api/health -H 'Host: cdthf.cn' 2>/dev/null)
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  echo "✅ 健康检查通过"
else
  echo "❌ 健康检查失败: $HEALTH"
  echo "回滚到上一个版本 ..."
  PREV=$(docker images "$IMAGE_NAME" --format '{{.Tag}}' | grep -v latest | sort -r | head -2 | tail -1)
  if [ -n "$PREV" ]; then
    docker stop hubforge-portal 2>/dev/null || true
    docker rm hubforge-portal 2>/dev/null || true
    docker run -d --name hubforge-portal --network hubforge_default --alias portal --restart unless-stopped \
      -e "DATABASE_URL=postgresql://hubforge:***@postgres:5432/hubforge?schema=public" \
      -e "JWT_SECRET=HubFor2026JWTSecret" \
      -e "COOKIE_NAME=hubforge-token" \
      -e "NEXT_PUBLIC_APP_URL=https://cdthf.cn" \
      -e "NODE_ENV=production" \
      -p 3001:3000 \
      "$IMAGE_NAME:$PREV"
    echo "已回滚到 $IMAGE_NAME:$PREV"
  fi
  exit 1
fi

# 5. 清理旧镜像
echo ""
echo "[5/5] 清理旧镜像（保留最近 $KEEP_VERSIONS 个版本）..."
OLD_TAGS=$(docker images "$IMAGE_NAME" --format '{{.Tag}}' | grep -v latest | sort -r | tail -n +$((KEEP_VERSIONS + 1)))
CLEANED=0
for tag in $OLD_TAGS; do
  docker rmi "$IMAGE_NAME:$tag" 2>/dev/null && echo "  删除: $IMAGE_NAME:$tag" && CLEANED=$((CLEANED + 1))
done
docker image prune -f 2>/dev/null | grep "Total reclaimed" || true
echo "清理完成，删除 $CLEANED 个旧版本"

echo ""
echo "=========================================="
echo " 部署完成！"
echo " 版本: $IMAGE_NAME:$VERSION"
echo " 地址: https://cdthf.cn"
echo "=========================================="
