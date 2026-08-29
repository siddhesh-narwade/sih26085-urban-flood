from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
from app.models.schemas import RouteRequest, RoutePlanResponse
from app.data_loader import dataset
from app.api.simulation_routes import simulation_engine
from app.engine.routing import FloodAwareRouter
from app.config import settings

router = APIRouter(prefix="/api/route", tags=["Routing"])

# Instantiate router singleton
router_engine = FloodAwareRouter(roads_geojson=dataset.roads)

@router.post("/plan", response_model=RoutePlanResponse)
def plan_flood_route(request: RouteRequest) -> RoutePlanResponse:
    """
    Computes direct vs safe flood-avoidance route for specified emergency vehicle type.
    """
    sim = simulation_engine.latest_simulation_result
    if not sim:
        sim = simulation_engine.run_nowcast_simulation()

    # Find closest simulation step at requested time
    timeline = sim.get("timeline", [])
    step_data = min(timeline, key=lambda x: abs(x["time_minute"] - request.time_minute)) if timeline else {}

    try:
        response = router_engine.plan_route(request, step_data)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Routing error: {str(e)}")

@router.get("/nodes")
def get_route_junctions() -> List[Dict[str, Any]]:
    """
    Returns list of road network junctions available for route selection.
    """
    junctions = []
    for f in dataset.roads.get("features", []):
        p = f["properties"]
        coords = f["geometry"]["coordinates"]
        junctions.append({
            "id": p["from_node"],
            "name": p["from_node"].replace("J_", "").replace("_", " ").title(),
            "coordinates": coords[0]
        })
        junctions.append({
            "id": p["to_node"],
            "name": p["to_node"].replace("J_", "").replace("_", " ").title(),
            "coordinates": coords[1]
        })
    # Deduplicate by id
    unique = {j["id"]: j for j in junctions}
    return list(unique.values())

@router.get("/profiles")
def get_vehicle_profiles() -> Dict[str, Any]:
    """
    Returns supported emergency and civilian vehicle clearance profiles.
    """
    return settings.VEHICLE_PROFILES
