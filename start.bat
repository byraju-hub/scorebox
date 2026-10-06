@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PY=
where python >nul 2>nul && python -c "import sys" >nul 2>nul && set PY=python
if "%PY%"=="" where py >nul 2>nul && set PY=py
if "%PY%"=="" (
  echo.
  echo [오류] Python 을 찾을 수 없습니다.
  echo   1. https://www.python.org/downloads/ 에서 Python 을 설치하세요.
  echo   2. 설치 첫 화면에서 "Add python.exe to PATH" 를 꼭 체크하세요.
  echo   3. 설치 후 이 파일을 다시 실행하세요.
  echo.
  pause
  exit /b 1
)
%PY% server.py
echo.
echo [종료됨] 위에 오류 메시지가 있으면 그 내용을 알려주세요.
pause
