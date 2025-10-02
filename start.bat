@echo off
chcp 65001 >nul
echo ========================================
echo           用户管理系统一键启动
echo ========================================
echo.

echo [1/4] 正在清理旧的Node.js进程...
taskkill /f /im node.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ 已清理旧进程
) else (
    echo ✓ 没有发现旧进程
)

echo.
echo [2/4] 检查依赖包...
if not exist "node_modules" (
    echo 正在安装依赖包...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ 依赖包安装失败
        pause
        exit /b 1
    )
) else (
    echo ✓ 依赖包已存在
)

echo.
echo [3/4] 检查数据库...
if not exist "database.db" (
    echo 正在初始化数据库...
    npm run init-db
    if %errorlevel% neq 0 (
        echo ❌ 数据库初始化失败
        pause
        exit /b 1
    )
) else (
    echo ✓ 数据库已存在
)

echo.
echo [4/4] 启动服务器...
echo ✓ 服务器正在启动，请稍候...
echo.
echo ========================================
echo   服务器地址: http://localhost:3000
echo   测试页面: http://localhost:3000/test.html
echo   默认管理员: admin / admin
echo ========================================
echo.
echo 正在启动服务器并打开浏览器...
echo 按 Ctrl+C 可停止服务器
echo.

REM 启动服务器（后台运行）
start /B npm start

REM 等待服务器启动
timeout /t 3 /nobreak >nul

REM 打开浏览器
start http://localhost:3000

REM 保持控制台窗口打开
echo.
echo 服务器已启动，浏览器已打开
echo 如需停止服务器，请按 Ctrl+C
pause
