@echo off
setlocal
cd /d "%~dp0.."

if not exist ".venv\Scripts\python.exe" (
  echo [ERROR] Python venv not found.
  echo Run: npm run setup:python
  pause
  exit /b 1
)

where nssm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] NSSM was not found in PATH.
  echo Put nssm.exe in PATH first, or run this manually from your NSSM folder.
  pause
  exit /b 1
)

nssm install JARVIS-PYTHON "%CD%\.venv\Scripts\python.exe" "%CD%\src\services\python\worker.py"
nssm set JARVIS-PYTHON AppDirectory "%CD%"
nssm set JARVIS-PYTHON Start SERVICE_AUTO_START
nssm set JARVIS-PYTHON AppStdout "%CD%\python-service.log"
nssm set JARVIS-PYTHON AppStderr "%CD%\python-service-error.log"
nssm start JARVIS-PYTHON

echo [OK] JARVIS-PYTHON service installed and started.
pause
