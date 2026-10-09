@echo off
chcp 65001 >nul
cd /d "%~dp0"
where git >nul 2>nul || (
  echo.
  echo [오류] git 이 설치되어 있지 않습니다. https://git-scm.com/download/win 에서 설치하세요.
  echo.
  pause
  exit /b 1
)
git rev-parse --is-inside-work-tree >nul 2>nul || (
  echo.
  echo [오류] 이 폴더는 git 으로 받은 폴더가 아니라서 업데이트할 수 없습니다.
  echo        ZIP 으로 받은 폴더에서는 실행되지 않습니다.
  echo        PowerShell 에서 아래 명령으로 새로 받은 뒤, 그 폴더에서 실행하세요.
  echo          git clone https://github.com/byraju-hub/scorebox.git
  echo.
  pause
  exit /b 1
)
echo 최신 버전을 받는 중...
git pull
if errorlevel 1 (
  echo.
  echo [오류] 업데이트에 실패했습니다. 위의 메시지를 확인하세요.
  echo.
  pause
  exit /b 1
)
echo.
echo 완료되었습니다. 이미 실행 중이면 브라우저에서 Ctrl+F5 를 누르세요.
pause
