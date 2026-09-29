@echo off
rem Sends the latest saved code to GitHub. Double-click this file.
rem The first time, a GitHub sign-in window opens - sign in and click Authorize.
cd /d "%~dp0"
set "PATH=%LOCALAPPDATA%\Programs\git\cmd;%PATH%"
git push -u origin main
echo.
if errorlevel 1 (
  echo Push failed. Check the message above.
) else (
  echo Done! Code is on GitHub.
)
pause
