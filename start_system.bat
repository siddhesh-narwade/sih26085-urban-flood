@echo off
echo ======================================================================
echo SIH 26085: URBAN FLOOD NOWCASTING SYSTEM (MoES / NCMRWF)
echo ======================================================================
echo Starting services with secure MOSDAC credential prompts ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start_system.ps1"

echo.
echo Both services launched! Open browser at: http://localhost:5173
echo ======================================================================
pause
