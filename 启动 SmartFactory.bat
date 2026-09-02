@echo off
chcp 65001 >nul
cd /d "%~dp0"
title SmartFactory MES

if not exist "backend\node_modules" (
  echo 首次启动，正在安装后端和前端依赖，请稍候...
  call npm run install:all
  if errorlevel 1 (
    echo 依赖安装失败，请确认已安装 Node.js 20.19 或更高版本。
    pause
    exit /b 1
  )
)

start "SmartFactory MES 服务" cmd /k "cd /d ""%~dp0"" && npm run dev"
timeout /t 5 /nobreak >nul
start "" "http://localhost:5173"
