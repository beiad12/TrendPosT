#!/usr/bin/env bash
# macOS/Linux counterpart to LAUNCH.bat
cd "$(dirname "$0")"

echo "============================================"
echo "  TrendPost / Maroc Viral - Launcher"
echo "============================================"
echo

if [ ! -d server/node_modules ] || [ ! -d client/node_modules ]; then
  echo "[ERROR] Dependencies are not installed yet."
  echo "Please run ./install.sh first."
  exit 1
fi

cleanup() {
  echo
  echo "Stopping TrendPost..."
  kill "$SERVER_PID" "$CLIENT_PID" 2>/dev/null
  exit 0
}
trap cleanup INT TERM

echo "Starting API server on http://localhost:4000 ..."
(cd server && npm run dev) &
SERVER_PID=$!

echo "Starting web app on http://localhost:5173 ..."
(cd client && npm run dev) &
CLIENT_PID=$!

sleep 4

URL="http://localhost:5173"
if command -v open >/dev/null 2>&1; then open "$URL"
elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"
fi

echo
echo "TrendPost is running. Press Ctrl+C to stop it."
wait
