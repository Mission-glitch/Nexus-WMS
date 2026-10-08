@echo off
title Nexus WMS Server - Enterprise Pro
cd /d "%~dp0"

echo ====================================================
echo   [NEXUS WMS] Starting Enterprise Pro System
echo   Database: SQLite (nexus_wms.db)
echo ====================================================
echo.

:: Check and free Port 3300 if occupied
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3300" ^| findstr "LISTENING"') do (
    echo [INFO] Detected active process on Port 3300 (PID: %%a). Freeing port...
    taskkill /F /PID %%a >nul 2>&1
    timeout /t 1 /nobreak >nul
)

:: Get local IP address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set IP=%%a
    goto :found_ip
)
:found_ip
set IP=%IP: =%

echo  PC URL:     http://localhost:3300
if not "%IP%"=="" (
    echo  Mobile URL: http://%IP%:3300
)
echo.
echo  Press Ctrl+C to stop the server at any time.
echo.

:: Open browser automatically after server initializes (2-second delay to avoid race condition)
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3300"

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% equ 0 (
    echo [INFO] Starting Nexus WMS with Node.js & SQLite persistent database...
    node server.js
) else (
    echo [INFO] Node.js not found in PATH.
    echo [INFO] Launching Nexus WMS via Python web server on Port 3300 (Standalone Mode)...
    python -m http.server 3300 --directory public
)

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to start server.
    echo Please make sure Node.js (https://nodejs.org) or Python is installed.
)

pause
