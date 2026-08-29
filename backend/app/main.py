import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.config import settings
from app.api import simulation_routes, drainage_routes, routing_routes, data_routes

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Drainage-Coupled Urban Flood Digital Twin & 0-3hr Nowcasting System (MoES / NCMRWF - SIH 26085)",
    version=settings.VERSION
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Sub-Routers
app.include_router(simulation_routes.router)
app.include_router(drainage_routes.router)
app.include_router(routing_routes.router)
app.include_router(data_routes.router)

# Mount Frontend Static Build if available
FRONTEND_DIST = os.path.join(settings.BASE_DIR, "frontend", "dist")

if os.path.exists(FRONTEND_DIST):
    # Mount assets subfolder
    assets_dir = os.path.join(FRONTEND_DIST, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/")
    async def serve_index():
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))

    @app.get("/{catchall:path}")
    async def serve_spa_fallback(catchall: str):
        # Allow /docs, /openapi.json, /api to pass through
        if catchall.startswith("api") or catchall.startswith("docs") or catchall.startswith("openapi.json"):
            return None
        file_path = os.path.join(FRONTEND_DIST, catchall)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
else:
    @app.get("/")
    def root_endpoint():
        return {
            "status": "ONLINE",
            "system": settings.PROJECT_NAME,
            "organization": settings.ORGANIZATION,
            "docs_url": "/docs",
            "demo_mode": settings.DEMO_MODE,
            "version": settings.VERSION
        }

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
