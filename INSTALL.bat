@echo off
setlocal enabledelayedexpansion
title TrendPost - Installer

echo ============================================
echo   TrendPost / Maroc Viral - Installer
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found in PATH.
  echo Please install Node.js 20+ from https://nodejs.org then re-run INSTALL.bat
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node -v') do set NODE_VERSION=%%v
echo Found Node.js %NODE_VERSION%
echo.

echo [1/4] Installing server dependencies...
pushd "%~dp0server"
call npm install
if errorlevel 1 (
  echo [ERROR] Server dependency install failed. See output above.
  popd
  pause
  exit /b 1
)

echo.
echo [2/4] Preparing server\.env (encryption key for the AI-provider key vault)...
call npm run setup-env
popd

echo.
echo [3/4] Installing client dependencies...
pushd "%~dp0client"
call npm install
if errorlevel 1 (
  echo [ERROR] Client dependency install failed. See output above.
  popd
  pause
  exit /b 1
)
popd

echo.
echo [4/4] Done.
echo.
echo ============================================
echo  Installation complete!
echo  Double-click LAUNCH.bat to start TrendPost.
echo ============================================
echo.
pause
