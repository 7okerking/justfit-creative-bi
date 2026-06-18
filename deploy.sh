# 启动前端项目（--host 0.0.0.0 允许局域网访问）
cd /Users/smile/demo-01/frontend
npm run dev -- --host 0.0.0.0

# 启动后端项目（--host 0.0.0.0 允许局域网访问）
cd /Users/smile/demo-01/backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000