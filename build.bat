@echo off
setlocal EnableExtensions
cd /d C:\Edwin\NinoxPlanning || exit /b 1
node scripts\run-build.cjs
exit /b %errorlevel%