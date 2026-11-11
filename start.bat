@echo off
rem PixelCake - avvia backend + frontend con un doppio click.
rem Le due finestre restano aperte (log visibili); chiudile per fermare i server.

start "PixelCake Backend" cmd /k "cd /d %~dp0backend && venv\Scripts\python.exe main.py"
start "PixelCake Frontend" cmd /k "cd /d %~dp0frontend && pnpm dev"

rem Attendi qualche secondo e apri l'app nel browser
timeout /t 6 >nul
start http://localhost:5173
