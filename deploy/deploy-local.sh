#!/bin/bash
# ============================================================
# HubForge 本地部署入口
# 用法: bash deploy.sh
# 功能: 从本地同步代码到服务器并触发部署
# ============================================================
set -e

SERVER="root@47.96.96.143"
REMOTE_DIR="/opt/hubforge"
LOCAL_DIR="$(dirname "$0")/../03-开发"

echo "=========================================="
echo " HubForge 部署（本地 → 服务器）"
echo "=========================================="

# 1. 同步代码（排除构建产物和敏感文件）
echo ""
echo "[1/2] 同步代码到服务器 ..."
rsync -avz \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='.env.*' \
  -e "sshpass -e ssh -o StrictHostKeyChecking=no" \
  "$LOCAL_DIR/" "$SERVER:$REMOTE_DIR/" 2>&1 | tail -3
echo "✅ 代码同步完成"

# 2. 上传部署脚本并执行
echo ""
echo "[2/2] 触发服务器端部署 ..."
sshpass -e scp -o StrictHostKeyChecking=no "$(dirname "$0")/deploy.sh" "$SERVER:/tmp/deploy.sh" 2>/dev/null
sshpass -e ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$SERVER" "bash /tmp/deploy.sh"
