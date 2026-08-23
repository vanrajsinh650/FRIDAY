@echo off
echo.
echo  _____ ___ ___ ___   ___  __   __
echo ^|  ___^|  _^|_ _^|   \ / _ ^\ \ \ / /
echo ^| ^|_  ^| ^|  ^| ^|| ^|) ^| ^|_^| ^| \ V /
echo ^|  _^| ^| ^|__^| ^||  _/^|  _  ^|  ^| ^|
echo ^|_^|   ^|____|___^|_^|  ^|_^| ^|_^|  ^|_^|
echo.
echo  AI BACKEND STARTING...
echo.

REM Check if .env exists
if not exist .env (
    echo [ERROR] .env file not found!
    echo [INFO]  Copy .env.example to .env and add your GROQ_API_KEY
    echo.
    pause
    exit /b 1
)

REM Activate virtual environment
call .venv\Scripts\activate.bat

REM Start the server
echo [INFO] Starting FRIDAY on http://0.0.0.0:8000
echo [INFO] Open http://YOUR_PC_IP:8000 on your phone to test
echo.
uvicorn server.main:app --host 0.0.0.0 --port 8000 --reload
