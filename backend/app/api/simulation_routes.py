from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, Optional
from app.models.schemas import SimulationRequest, FloodExplainResponse
from app.data_loader import dataset
from app.engine.flood_engine import FloodNowcastEngine
from app.engine.explainability import explain_road_flooding

router = APIRouter(prefix="/api/simulation", tags=["Simulation"])

# Instantiate engine singleton
simulation_engine = FloodNowcastEngine(
    roads_geojson=dataset.roads,
    drainage_nodes_geojson=dataset.drainage_nodes,
    drainage_edges_geojson=dataset.drainage_edges,
    dem_payload=dataset.dem,
    scenarios_dict=dataset.scenarios
)

# Run initial default simulation on startup
simulation_engine.run_nowcast_simulation(SimulationRequest(
    scenario_id="cloudburst_emergency_120mm",
    rainfall_intensity_multiplier=1.0,
    blockage_percentage=25.0,
    conduit_capacity_multiplier=1.0,
    tide_level_m=2.6
))

@router.post("/run")
def run_simulation(request: SimulationRequest) -> Dict[str, Any]:
    """
    Executes 0-3 hour nowcasting simulation with custom hydrologic and hydraulic parameters.
    """
    try:
        result = simulation_engine.run_nowcast_simulation(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation error: {str(e)}")

@router.get("/current")
def get_current_simulation() -> Dict[str, Any]:
    """
    Retrieves the active simulation results and timeline.
    """
    if simulation_engine.latest_simulation_result is None:
        simulation_engine.run_nowcast_simulation(SimulationRequest())
    return simulation_engine.latest_simulation_result

@router.get("/scenarios")
def get_scenarios() -> Dict[str, Any]:
    """
    Lists all pre-configured nowcast scenarios.
    """
    return dataset.scenarios

@router.get("/explain/{road_id}", response_model=FloodExplainResponse)
def explain_flooding(
    road_id: str,
    time_min: int = Query(default=40, ge=0, le=180)
) -> FloodExplainResponse:
    """
    Provides explainable AI causal breakdown for flooding at a specific road segment and time step.
    """
    sim = simulation_engine.latest_simulation_result
    if not sim:
        sim = simulation_engine.run_nowcast_simulation(SimulationRequest())

    # Find closest time step
    timeline = sim.get("timeline", [])
    step_data = min(timeline, key=lambda x: abs(x["time_minute"] - time_min)) if timeline else {}

    return explain_road_flooding(
        road_id=road_id,
        road_data=simulation_engine.roads_dict,
        simulation_state_at_t=step_data,
        time_min=time_min
    )
