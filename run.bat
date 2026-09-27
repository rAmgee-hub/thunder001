@echo off
chcp 65001 >nul
title 메이플 시세 도구
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js가 설치되어 있지 않아요. install.bat을 먼저 실행하세요.
  pause
  exit /b 1
)
node server.js --open
if errorlevel 1 pause
