#!/bin/bash
# 一键启动（需已安装 Python3、Node.js）
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

cd "$ROOT/backend"
if [ ! -d .venv ]; then
  python3 -m venv .venv
  .venv/bin/pip install -r requirements.txt -q
fi
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 &
BACK_PID=$!

cd "$ROOT/frontend"
if [ ! -d node_modules ]; then
  npm install
fi
npm run dev &
FRONT_PID=$!

echo "后端 PID: $BACK_PID  (http://127.0.0.1:8000)"
echo "前端 PID: $FRONT_PID  (http://localhost:5173)"
echo "按 Ctrl+C 停止"
wait
