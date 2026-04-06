@echo off
echo Checking for running Node.js processes...
echo.

tasklist /FI "IMAGENAME eq node.exe" | find /I "node.exe" >nul
if %ERRORLEVEL% EQU 0 (
    echo Found Node.js processes. Stopping them...
    taskkill /F /IM node.exe
    echo.
) else (
    echo No Node.js processes found.
)

tasklist /FI "IMAGENAME eq npm.cmd" | find /I "npm.cmd" >nul
if %ERRORLEVEL% EQU 0 (
    echo Found npm processes. Stopping them...
    taskkill /F /IM npm.cmd
    echo.
) else (
    echo No npm processes found.
)

echo.
echo Done! You should now be able to rename the folder.
echo.
pause
