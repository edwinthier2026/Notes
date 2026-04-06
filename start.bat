@echo off
setlocal EnableExtensions
cd /d C:\Edwin\Notes || exit /b 1

echo Start Notes op http://127.0.0.1:8080
call start-full.bat
exit /b %errorlevel%
