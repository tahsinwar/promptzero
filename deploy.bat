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

REM ---------- STEP 0: Check for unfinished merge ----------
if exist ".git\MERGE_HEAD" (
    echo [WARN] Detected unfinished merge from previous session.
    echo [FIX]  Aborting old merge automatically...
    git merge --abort
    echo.
)

REM Stash local changes to avoid pull conflicts
git diff --quiet
if errorlevel 1 (
    echo [WARN] You have local uncommitted changes.
    echo [FIX]  Stashing them temporarily...
    git stash push -m "auto-stash before deploy" -u >nul
    set "STASHED=1"
    echo.
)

REM ---------- STEP 1: Git Pull ----------
echo [1/3] Pulling latest changes from GitHub...
echo ------------------------------------------------------------
git pull origin main
if errorlevel 1 (
    color 0C
    echo.
    echo [ERROR] git pull failed!
    echo.
    echo Try these manually:
    echo    git merge --abort
    echo    git status
    echo.
    pause
    exit /b 1
)
echo.
echo [OK] Pull successful!
echo.

if defined STASHED (
    echo [INFO] Restoring your local changes from stash...
    git stash pop >nul 2>&1
    echo.
)

REM ---------- STEP 2: Install dependencies if needed ----------
set "NEED_INSTALL="
if not exist "node_modules" set "NEED_INSTALL=1"
if not defined NEED_INSTALL goto :check_hash
goto :do_install

:check_hash
if not exist "node_modules\.deploy-install-hash" goto :do_install
for /f "delims=" %%H in ('certutil -hashfile package.json MD5 ^| find /v ":" ^| find /v "CertUtil"') do set "PKG_HASH=%%H"
set /p OLD_HASH=<node_modules\.deploy-install-hash
if not "!PKG_HASH!"=="!OLD_HASH!" goto :do_install
echo [2/3] Dependencies up to date, skipping npm install.
goto :after_install

:do_install
echo [2/3] Installing dependencies - package.json changed or first run...
echo ------------------------------------------------------------
call npm install
if errorlevel 1 (
    color 0C
    echo [ERROR] npm install failed!
    pause
    exit /b 1
)
for /f "delims=" %%H in ('certutil -hashfile package.json MD5 ^| find /v ":" ^| find /v "CertUtil"') do set "PKG_HASH=%%H"
> node_modules\.deploy-install-hash echo !PKG_HASH!

:after_install
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