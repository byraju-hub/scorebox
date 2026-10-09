@echo off
chcp 65001 >nul
cd /d "%~dp0"
where git >nul 2>nul || (
  echo [오류] git 이 설치되어 있지 않습니다. https://git-scm.com/download/win 에서 설치하세요.
  pause
  exit /b 1
)
echo 최신 버전을 받는 중...
git pull
echo.
echo 완료되었습니다. 이미 실행 중이면 브라우저에서 Ctrl+F5 를 누르세요.
pause
