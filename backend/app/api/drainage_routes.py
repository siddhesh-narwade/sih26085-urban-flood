from fastapi import APIRouter
from typing import Dict, Any
from app.data_loader import dataset
from app.api.simulation_routes import simulation_engine

router = APIRouter(prefix="/api/drainage", tags=["Drainage"])

@router.get("/nodes")
def get_drainage_nodes() -> Dict[str, Any]:
    """Returns GeoJSON FeatureCollection of drainage network nodes."""
    return dataset.drainage_nodes

@router.get("/edges")
def get_drainage_edges() -> Dict[str, Any]:
    """Returns GeoJSON FeatureCollection of drainage conduits."""
    return dataset.drainage_edges

@router.get("/status")
def get_drainage_status(time_min: int = 40) -> Dict[str, Any]:
    """
    Returns current hydraulic status (flow, capacity, utilization %, surcharge) for all drainage elements.
    """
    sim = simulation_engine.latest_simulation_result
    if not sim:
        sim = simulation_engine.run_nowcast_simulation()
    
    timeline = sim.get("timeline", [])
    step_data = min(timeline, key=lambda x: abs(x["time_minute"] - time_min)) if timeline else {}
    
    return {
        "time_minute": time_min,
        "nodes": step_data.get("drainage_nodes", {}),
        "edges": step_data.get("drainage_edges", {})
    }
