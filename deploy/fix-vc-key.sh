#!/bin/bash
# 重建 vc-inspection 容器，添加 AI_API_KEY
KEY=$(grep 'XIAOMI_API_KEY' ~/.hermes/.env | cut -d= -f2)

docker stop vc-inspection
docker rm vc-inspection

docker run -d \
  --name vc-inspection \
  --network hubforge_default \
  --restart unless-stopped \
  -e DATABASE_URL="sqlite:///./data/inspection.db" \
  -e AI_API_KEY="$KEY" \
  -v /opt/hubforge/vc-data:/app/data \
  hubforge-vc-inspection:latest

sleep 3
echo "=== 验证 ==="
docker exec vc-inspection printenv AI_API_KEY | head -c 15
echo "..."
curl -s http://localhost:8000/health
