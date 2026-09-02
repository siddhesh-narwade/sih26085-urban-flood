from fastapi import APIRouter
from typing import Dict, Any, List
from app.data_loader import dataset
from app.config import settings
from app.models.schemas import SystemHealthResponse, DataLayerMetadata
from app.api.simulation_routes import simulation_engine
from app.engine.mosdac_service import mosdac_service

router = APIRouter(prefix="/api/data", tags=["Data & System"])

@router.get("/health", response_model=SystemHealthResponse)
def get_system_health() -> SystemHealthResponse:
    """Returns backend system status and dataset statistics."""
    current_sim = simulation_engine.latest_simulation_result
    active_scen = current_sim["metadata"]["scenario_title"] if current_sim else "Default"
    
    return SystemHealthResponse(
        status="OPERATIONAL",
        demo_mode=settings.DEMO_MODE,
        project=settings.PROJECT_NAME,
        organization=settings.ORGANIZATION,
        study_area="Kurla West - BKC Basin, Mumbai",
        active_scenario=active_scen,
        nodes_count=len(dataset.drainage_nodes.get("features", [])),
        edges_count=len(dataset.drainage_edges.get("features", [])),
        roads_count=len(dataset.roads.get("features", []))
    )

@router.get("/roads")
def get_roads() -> Dict[str, Any]:
    """Returns road network FeatureCollection."""
    return dataset.roads

@router.get("/poi")
def get_poi() -> Dict[str, Any]:
    """Returns critical infrastructure POIs."""
    return dataset.pois

@router.get("/dem")
def get_dem() -> Dict[str, Any]:
    """Returns DEM elevation matrix and metadata."""
    return dataset.dem


@router.get("/mosdac/status")
def get_mosdac_status() -> Dict[str, Any]:
    latest = mosdac_service.latest_rainfall_field or {}
    return {
        "connected": bool(mosdac_service.username and mosdac_service.password),
        "credentials_configured": bool(mosdac_service.username and mosdac_service.password),
        "username": mosdac_service.username or None,
        "dataset_id": settings.MOSDAC_DATASET_ID,
        "last_sync": latest.get("timestamp", "Not yet synced"),
        "source": latest.get("source", "ISRO MOSDAC Satellite / DWR"),
        "active_file": latest.get("filename", "N/A"),
        "max_rain_mmh": latest.get("max_rain_mmh", 0.0),
        "mean_rain_mmh": latest.get("mean_rain_mmh", 0.0),
        "status": latest.get("status", "READY"),
    }


@router.post("/mosdac/sync")
def sync_mosdac() -> Dict[str, Any]:
    try:
        result = mosdac_service.sync_live_data()
        return {"success": True, "message": f"Successfully synced MOSDAC granule {result.get('filename')}", "data": result}
    except Exception as exc:
        return {"success": False, "error": str(exc)}


@router.get("/mosdac/granules")
def get_mosdac_granules() -> Dict[str, Any]:
    granules = mosdac_service.search_latest_granules(count=5)
    return {"dataset_id": settings.MOSDAC_DATASET_ID, "count": len(granules), "granules": granules}

@router.get("/provenance", response_model=List[DataLayerMetadata])
def get_data_provenance() -> List[DataLayerMetadata]:
    """
    Returns complete scientific provenance and classification (Real, Derived, Simulated).
    """
    return [
        DataLayerMetadata(
            layer_name="Doppler Weather Radar (DWR) & Satellite Precipitation",
            classification="REAL_PUBLIC_DATA",
            source="ISRO / SAC Meteorological & Oceanographic Satellite Data Archival Centre (MOSDAC)",
            spatial_resolution="HDF5 Level-2B Hydro-Estimator field over Mumbai",
            temporal_resolution="Live catalog refresh / timestamped granules",
            license="ISRO Open Data Access / Registered User License",
            notes="MOSDAC HEM rainfall is spatially extracted for the Kurla-BKC study area and used by the live simulation scenario.",
        ),
        DataLayerMetadata(
            layer_name="Road Network & Junctions",
            classification="REAL_PUBLIC_DATA",
            source="OpenStreetMap (OSM) via Overpass API / Mumbai Spatial Extract",
            spatial_resolution="Sub-meter vector geometry",
            temporal_resolution="Static (2024 OSM release)",
            license="Open Data Commons Open Database License (ODbL)",
            notes="Extracted bounding box for Kurla West, Sion, and BKC corridor."
        ),
        DataLayerMetadata(
            layer_name="Critical Infrastructure (Hospitals, Fire Stations)",
            classification="REAL_PUBLIC_DATA",
            source="Municipal Corporation of Greater Mumbai (MCGM) Open GeoPortal & OSM",
            spatial_resolution="Point vector coordinates",
            temporal_resolution="Static",
            license="Public Domain / ODbL",
            notes="Features Sion Hospital, Asian Heart Institute, Kurla Fire Station."
        ),
        DataLayerMetadata(
            layer_name="Digital Elevation Model (DEM)",
            classification="DERIVED_DATA",
            source="Copernicus GLO-30 / SRTM 30m with Urban Micro-Topography Resampling",
            spatial_resolution="100m raster matrix (25x25 spatial grid)",
            temporal_resolution="Static terrain",
            license="Copernicus Open Access / NASA Public Domain",
            notes="Derived slope gradients, aspect, and D8 steepest-descent flow directions."
        ),
        DataLayerMetadata(
            layer_name="Stormwater Drainage Network & Conduits",
            classification="SIMULATED_DATA",
            source="Hydraulically Calibrated Synthetic Municipal Network",
            spatial_resolution="Node-edge directed graph (18 nodes, 19 conduits)",
            temporal_resolution="N/A",
            license="Proprietary Prototype Architecture (SIH 26085)",
            notes="Physical parameters (diameters 600-1800mm, Manning roughness n=0.013, invert elevations) synthesized based on standard municipal drainage codes."
        ),
        DataLayerMetadata(
            layer_name="Nowcast Rainfall Scenarios (0-3h)",
            classification="SIMULATED_DATA / REAL_API_ADAPTER",
            source="NCMRWF / IMD Convective Cloudburst Profiles + Open-Meteo Fallback",
            spatial_resolution="Continuous spatial Gaussian moving storm field",
            temporal_resolution="10-minute forecast timesteps up to 180 min",
            license="MoES Research Reference / Open-Meteo Free API",
            notes="Simulates extreme cloudburst (120 mm/hr), heavy downpour (75 mm/hr), and compound tidal lock."
        )
    ]
