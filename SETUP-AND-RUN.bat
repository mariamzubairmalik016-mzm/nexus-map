@echo off
setlocal
title NEXUS MAP Setup

echo ================================================
echo NEXUS MAP - Frontend + Backend Same Folder Setup
echo ================================================
echo.

if not exist package.json (
  echo ERROR: Run this file from the nexus-map root folder.
  echo It must be beside the frontend package.json.
  pause
  exit /b 1
)

if not exist backend\package.json (
  echo ERROR: backend\package.json was not found.
  echo Make sure the backend folder is directly inside nexus-map.
  pause
  exit /b 1
)

echo [1/4] Installing frontend dependencies...
call npm install
if errorlevel 1 goto fail

echo.
echo [2/4] Installing backend dependencies...
pushd backend
call npm install
if errorlevel 1 (
  popd
  goto fail
)
popd

echo.
echo [3/4] Creating frontend .env when missing...
if not exist .env (
  (
    echo VITE_API_URL=http://localhost:5000/api
  ) > .env
  echo Frontend .env created.
) else (
  echo Frontend .env already exists - not overwritten.
)

echo.
echo [4/4] Checking backend .env...
if not exist backend\.env (
  copy backend\.env.example backend\.env >nul
  echo Backend .env created from .env.example.
  echo IMPORTANT: Open backend\.env and add your NEW rotated TOMTOM_API_KEY.
) else (
  echo Backend .env already exists - not overwritten.
)

echo.
echo ================================================
echo Setup complete.
echo.
echo 1. Put your NEW TomTom key in backend\.env
echo 2. Run START-NEXUS-MAP.bat
echo ================================================
pause
exit /b 0

:fail
echo.
echo Installation failed. Read the first red npm error above.
pause
exit /b 1
