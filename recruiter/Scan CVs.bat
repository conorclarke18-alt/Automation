@echo off
REM Double-click to scan a local folder of CVs and produce cv_index.csv.
REM Keep this file in the same folder as scan_cvs.py.
setlocal

cd /d "%~dp0"

where py >nul 2>&1
if %errorlevel%==0 (
  set "PY=py"
) else (
  where python >nul 2>&1
  if %errorlevel%==0 (
    set "PY=python"
  ) else (
    echo.
    echo Python was not found on this PC.
    echo Install it from https://www.python.org/downloads/ and tick
    echo "Add python.exe to PATH" during setup, then run this again.
    echo.
    pause
    exit /b 1
  )
)

echo.
echo Drag the CV folder onto this window and press Enter,
echo or just press Enter to be asked for the path.
echo.
set /p FOLDER="Folder: "

if "%FOLDER%"=="" (
  %PY% scan_cvs.py
) else (
  %PY% scan_cvs.py %FOLDER%
)

echo.
pause
