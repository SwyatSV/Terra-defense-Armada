@echo off
setlocal
cd /d "%~dp0"
call npm.cmd run build
if errorlevel 1 (
  echo Build failed. Please keep this window open and report the error above.
  pause
  exit /b 1
)
echo Open http://127.0.0.1:4173/ in your browser.
call npm.cmd run preview -- --port 4173 --strictPort
pause
