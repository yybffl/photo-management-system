# PowerShell 版本的一键启动脚本
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "           用户管理系统一键启动" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/4] 正在清理旧的Node.js进程..." -ForegroundColor Yellow
try {
    $processes = Get-Process -Name "node" -ErrorAction SilentlyContinue
    if ($processes) {
        $processes | Stop-Process -Force
        Write-Host "✓ 已清理 $($processes.Count) 个旧进程" -ForegroundColor Green
    } else {
        Write-Host "✓ 没有发现旧进程" -ForegroundColor Green
    }
} catch {
    Write-Host "✓ 没有发现旧进程" -ForegroundColor Green
}

Write-Host ""
Write-Host "[2/4] 检查依赖包..." -ForegroundColor Yellow
if (!(Test-Path "node_modules")) {
    Write-Host "正在安装依赖包..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 依赖包安装失败" -ForegroundColor Red
        Read-Host "按回车键退出"
        exit 1
    }
} else {
    Write-Host "✓ 依赖包已存在" -ForegroundColor Green
}

Write-Host ""
Write-Host "[3/4] 检查数据库..." -ForegroundColor Yellow
if (!(Test-Path "database.db")) {
    Write-Host "正在初始化数据库..." -ForegroundColor Yellow
    npm run init-db
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 数据库初始化失败" -ForegroundColor Red
        Read-Host "按回车键退出"
        exit 1
    }
} else {
    Write-Host "✓ 数据库已存在" -ForegroundColor Green
}

Write-Host ""
Write-Host "[4/4] 启动服务器..." -ForegroundColor Yellow
Write-Host "✓ 服务器正在启动，请稍候..." -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   服务器地址: http://localhost:3000" -ForegroundColor White
Write-Host "   测试页面: http://localhost:3000/test.html" -ForegroundColor White
Write-Host "   默认管理员: admin / admin" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "按 Ctrl+C 可停止服务器" -ForegroundColor Yellow
Write-Host ""

npm start
