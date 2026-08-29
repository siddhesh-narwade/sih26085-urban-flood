@echo off
echo ======================================================================
echo SIH 26085: URBAN FLOOD NOWCASTING SYSTEM (MoES / NCMRWF)
echo ======================================================================
echo Starting FastAPI Backend on http://127.0.0.1:8000 ...
start cmd /k "cd backend && python run.py"

echo Starting React GIS Command Center on http://localhost:5173 ...
start cmd /k "cd frontend && npm run dev"

echo.
echo Both services launched! Open browser at: http://localhost:5173
echo ======================================================================
pause
