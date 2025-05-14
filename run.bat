@echo off
TITLE Discord Bot Setup For The Technically Impaired
COLOR 0A

:: Keep window open regardless of errors
echo Starting setup process...

:: Save current directory
set ORIGINAL_DIR=%CD%

:: Make sure Python is working
echo Checking Python installation...
python --version
if %ERRORLEVEL% NEQ 0 (
  echo Python not found
  echo Installing Python 3.12.3...
  
  :: Download and install Python mabye 3.12.3 or latest
  powershell -Command "Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.12.3/python-3.12.3-amd64.exe' -OutFile 'python-installer.exe'"
  start /wait python-installer.exe /quiet InstallAllUsers=1 PrependPath=1 Include_test=0
  
  echo Please restart your computer and run this script again
  pause
  exit /b 1
)

:: Set up virtual environment
echo Setting up virtual environment...
if not exist venv (
  python -m venv venv
)

:: Activate virtual environment explicitly
call venv\Scripts\activate.bat

:: Make .env if not found
if not exist src/.env (
  echo API_KEY> src/.env
  echo BOT_TOKEN>> src/.env
)

:: Install required packages
echo Installing requirements...
pip install discord.py aiohttp python-dotenv json5 httpx dotenv

:: Show what files exist in the directory
echo Files in current directory:
dir

:: Check if lazy_ui.py exists
if not exist lazy_ui.py (
  echo ERROR: lazy_ui.py not found in current directory!
  echo Current directory: %CD%
  dir
  pause
  exit /b 1
)

:: Actually run the UI
echo Starting lazy_ui.py...
python lazy_ui.py

:: If we get here, there was an error
echo You can try running these commands manually:
echo cd %ORIGINAL_DIR%
echo venv\Scripts\activate.bat
echo python lazy_ui.py
pause