#!/bin/bash
# 读取本地 key 并写入服务器 .env 文件
KEY=$(grep 'XIAOMI_API_KEY' ~/.hermes/.env | cut -d= -f2)
echo "AI_API_KEY=${KEY}" > /tmp/vc-env
echo "AI_MODEL=mimo-v2.5" >> /tmp/vc-env
echo "AI_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1" >> /tmp/vc-env
echo "Key written: ${KEY:0:10}..."
