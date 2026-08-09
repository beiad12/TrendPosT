#!/usr/bin/env bash
# macOS/Linux counterpart to INSTALL.bat
set -e
cd "$(dirname "$0")"

echo "============================================"
echo "  TrendPost / Maroc Viral - Installer"
echo "============================================"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js was not found in PATH."
  echo "Please install Node.js 20+ from https://nodejs.org then re-run ./install.sh"
  exit 1
fi
echo "Found $(node -v)"

echo
echo "[1/4] Installing server dependencies..."
(cd server && npm install)

echo
echo "[2/4] Preparing server/.env (encryption key for the AI-provider key vault)..."
(cd server && npm run setup-env)

echo
echo "[3/4] Installing client dependencies..."
(cd client && npm install)

echo
echo "[4/4] Done."
echo
echo "============================================"
echo " Installation complete!"
echo " Run ./launch.sh to start TrendPost."
echo "============================================"
