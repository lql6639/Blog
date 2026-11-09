#!/bin/zsh
# 双击即可：启动 VitePress 开发服务器并打开浏览器
# 关闭此终端窗口即停止服务（或按 Ctrl+C）

cd "$(dirname "$0")" || exit 1

# 载入 nvm，确保能找到 pnpm / node
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1

if ! command -v pnpm >/dev/null 2>&1; then
  echo "✘ 找不到 pnpm。请先在终端执行：corepack enable"
  read -r "?按回车退出"
  exit 1
fi

# 首次使用或依赖有变动时自动安装
if [ ! -d node_modules ]; then
  echo "▸ 未发现 node_modules，先安装依赖…"
  pnpm install || { echo "✘ 依赖安装失败"; read -r "?按回车退出"; exit 1; }
fi

echo "▸ 启动开发服务器（端口 9877）…"
pnpm dev &
DEV_PID=$!

# 等服务起来再开浏览器
for _ in {1..40}; do
  if curl -s -o /dev/null --max-time 1 --noproxy '*' http://127.0.0.1:9877/; then
    open "http://localhost:9877/"
    break
  fi
  sleep 0.5
done

wait $DEV_PID
