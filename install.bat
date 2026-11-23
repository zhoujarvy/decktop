@echo off
chcp 65001 >nul
setlocal
set "REPO=%~dp0"
set "TARGET=%USERPROFILE%\.glzr\zebar\decktop"

echo ============================================
echo   Decktop 桌面小组件 安装
echo ============================================

rem -- 1) 检查/安装 zebar --
where zebar >nul 2>nul
if errorlevel 1 (
  echo [1/4] 未检测到 zebar，尝试 winget 安装...
  winget install --id glzr-io.zebar --accept-source-agreements --accept-package-agreements
) else (
  echo [1/4] zebar 已安装
)

rem -- 2) 生成本机配置 --
if not exist "%REPO%pack\config.js" (
  copy "%REPO%pack\config.example.js" "%REPO%pack\config.js" >nul
  echo [2/4] 已生成 pack\config.js（可稍后用小组件设置面板填写密钥）
) else (
  echo [2/4] 配置文件已存在，跳过
)

rem -- 3) 建立映射（源码目录 即 zebar pack 目录）--
if exist "%TARGET%" rmdir "%TARGET%" >nul 2>nul
mkdir "%USERPROFILE%\.glzr\zebar" 2>nul
mklink /J "%TARGET%" "%REPO%pack" >nul
if errorlevel 1 (
  echo [x] 映射创建失败：若 %USERPROFILE%\.glzr\zebar\decktop 已有同名文件夹，请先删除
  exit /b 1
)
echo [3/4] 已映射 %TARGET% --^> %REPO%pack

rem -- 4) 启动 --
if exist "C:\Program Files\glzr.io\Zebar\zebar.exe" (
  start "" "C:\Program Files\glzr.io\Zebar\zebar.exe" startup
) else (
  start "" zebar startup
)
echo [4/4] 已启动 zebar

echo.
echo [OK] 安装完成！
echo   - 卡片没出现的话：zebar 托盘图标 -^> Widget packs -^> decktop 逐个启动
echo   - 开机自启：zebar 托盘右键 -^> Run on startup
echo   - 配置入口：桌面右侧卡片列底部的“设 置”条
echo.
pause
