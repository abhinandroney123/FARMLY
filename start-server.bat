@echo off
title FARMLY Poultry Management Server
cd /d "%~dp0"

echo ========================================================================
echo                 FARMLY POULTRY FARM MANAGEMENT SYSTEM
echo ========================================================================
echo.
echo Starting backend server on http://localhost:8080 ...
echo Press Ctrl+C in this window anytime to stop the server.
echo.

:: Open browser after a 2-second delay
start /b "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:8080"

:: Run Node server
node server.js
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Server exited with an error.
    pause
)
