@echo off
setlocal EnableExtensions
cd /d C:\Edwin\Notes
if errorlevel 1 goto bad_dir

echo ============================================================
echo Notes start - http://127.0.0.1:8080
echo ============================================================
echo.

if defined NVM_SYMLINK set "PATH=%NVM_SYMLINK%;%PATH%"
if defined NVM_HOME set "PATH=%NVM_HOME%;%PATH%"
if exist "%ProgramFiles%\nodejs" set "PATH=%ProgramFiles%\nodejs;%PATH%"

set "NODE_VERSION="
for /f %%v in ('node -v 2^>nul') do set "NODE_VERSION=%%v"
if not defined NODE_VERSION goto no_node

set "NODE_MAJOR="
for /f "tokens=1 delims=." %%m in ("%NODE_VERSION:~1%") do set "NODE_MAJOR=%%m"
if not defined NODE_MAJOR goto no_node

if %NODE_MAJOR% LSS 20 goto bad_node
if %NODE_MAJOR% GEQ 24 goto bad_node

if not exist node_modules\vite (
  echo [INFO] node_modules ontbreekt of incompleet. npm install wordt uitgevoerd...
  call npm install
  if errorlevel 1 goto install_failed
)

for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":8080 .*LISTENING"') do taskkill /F /PID %%p >nul 2>&1

echo [INFO] Start Vite devserver...
echo [INFO] Open daarna: http://127.0.0.1:8080
echo.
node scripts\run-dev.cjs --port 8080
if errorlevel 1 goto dev_failed
exit /b 0

:bad_dir
echo [ERROR] Projectmap niet gevonden: C:\Edwin\Notes
pause
exit /b 1

:no_node
echo [ERROR] Node.js niet gevonden in PATH.
echo Gebruik Node 22 LTS en probeer opnieuw.
pause
exit /b 1

:bad_node
echo [ERROR] Node %NODE_VERSION% wordt niet ondersteund.
echo Gebruik Node 22 LTS.
pause
exit /b 1

:install_failed
echo [ERROR] npm install mislukt.
pause
exit /b 1

:dev_failed
echo [ERROR] Start mislukt. Zie foutmelding hierboven.
pause
exit /b 1
