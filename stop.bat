@echo off
title Nexus WMS Server - Stop
echo ====================================================
echo   🛑 Stopping Nexus WMS Server (Port 3300)...
echo ====================================================

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3300 ^| findstr LISTENING') do (
    echo Terminating PID: %%a
    taskkill /F /PID %%a 2>nul
)

echo.
echo ✅ Server stopped successfully!
timeout /t 3
