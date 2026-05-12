@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title PromptZero - Deploy to Cloudflare
color 0B

echo.
echo ============================================================
echo    PROMPTZERO - AUTO DEPLOY TO CLOUDFLARE WORKERS
echo ============================================================
echo.

REM Move to the folder where this .bat file lives
cd /d "%~dp0"
echo [INFO] Project folder: %CD%
echo.

REM ---------- STEP 1: Git Pull ----------
echo [1/3] Pulling latest changes from GitHub...
echo ------------------------------------------------------------
git pull origin main
if errorlevel 1 (
    color 0C
    echo.
    echo [ERROR] git pull failed! Check your internet or git status.
    echo.
    pause
    exit /b 1
)
echo.
echo [OK] Pull successful!
echo.

REM ---------- STEP 2: Install dependencies if needed ----------
if not exist "node_modules" (
    echo [2/3] node_modules not found, running npm install...
    echo ------------------------------------------------------------
    call npm install
    if errorlevel 1 (
        color 0C
        echo [ERROR] npm install failed!
        pause
        exit /b 1
    )
) else (
    echo [2/3] Dependencies already installed, skipping npm install.
)
echo.

REM ---------- STEP 3: Deploy ----------
echo [3/3] Building and deploying to Cloudflare Workers...
echo ------------------------------------------------------------
call npm run deploy
if errorlevel 1 (
    color 0C
    echo.
    echo [ERROR] Deploy failed! Scroll up to see the error.
    echo.
    pause
    exit /b 1
)

REM ---------- SUCCESS ----------
color 0A
echo.
echo ============================================================
echo    DEPLOY SUCCESSFUL!
echo ============================================================
echo.
echo    Live URL:  https://tanstack-start-app.tahsinwap.workers.dev
echo    Custom:    https://promptzero.lovable.app
echo.
echo ============================================================
echo.
echo Press any key to close this window...
pause >nul
exit /b 0