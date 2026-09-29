@echo off
rem Starts the auction app. Double-click this file, or run "start" / ".\start.cmd" in a terminal.
cd /d "%~dp0"
set "PATH=%LOCALAPPDATA%\Programs\nodejs;%LOCALAPPDATA%\Programs\git\cmd;%PATH%"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install it from https://nodejs.org and try again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing packages, first time only...
  call npm install --no-fund --no-audit || (pause & exit /b 1)
)

echo.
echo Auction app starting...
echo   On this PC:     http://localhost:5173
echo   Projector view: http://localhost:5173/live
echo Keep this window open during the auction. Press Ctrl+C to stop.
echo.
start "" http://localhost:5173
call npm run dev
pause
