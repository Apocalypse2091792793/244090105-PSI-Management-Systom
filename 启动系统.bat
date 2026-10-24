@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo   商品购销存管理系统 启动中...
echo ========================================
echo.
node server.js
pause
