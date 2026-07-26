@echo off
setlocal
title Start NEXUS MAP

if not exist package.json (
  echo ERROR: This file must be inside the nexus-map root folder.
  pause
  exit /b 1
)

if not exist backend\package.json (
  echo ERROR: backend\package.json was not found.
  pause
  exit /b 1
)

echo Starting backend in a new terminal...
start "NEXUS MAP Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"

timeout /t 3 /nobreak >nul

echo Starting frontend in a new terminal...
start "NEXUS MAP Frontend" cmd /k "cd /d "%~dp0" && npm run dev"

echo.
echo Frontend normally: http://localhost:5173
echo Backend health:    http://localhost:5000/api/health
echo Map page:          http://localhost:5173/map
echo.
pause
