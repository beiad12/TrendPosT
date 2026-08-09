@echo off
title TrendPost - Launcher

echo ============================================
echo   TrendPost / Maroc Viral - Launcher
echo ============================================
echo.

if not exist "%~dp0server\node_modules" (
  echo [ERROR] Dependencies are not installed yet.
  echo Please run INSTALL.bat first.
  echo.
  pause
  exit /b 1
)

if not exist "%~dp0client\node_modules" (
  echo [ERROR] Dependencies are not installed yet.
  echo Please run INSTALL.bat first.
  echo.
  pause
  exit /b 1
)

echo Starting API server on http://localhost:4000 ...
start "TrendPost API" cmd /k "cd /d "%~dp0server" && npm run dev"

echo Starting web app on http://localhost:5173 ...
start "TrendPost Web" cmd /k "cd /d "%~dp0client" && npm run dev"

echo Waiting for the web app to come up...
timeout /t 6 /nobreak >nul

start "" "http://localhost:5173"

echo.
echo TrendPost is running in the two new terminal windows.
echo Close those windows (or press Ctrl+C in each) to stop it.
echo.
pause
