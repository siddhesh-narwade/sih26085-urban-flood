import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend"))

from app.data_loader import dataset
from app.models.schemas import RouteRequest
from app.engine.routing import FloodAwareRouter

def test_routing_dry_conditions():
    router = FloodAwareRouter(dataset.roads)
    req = RouteRequest(
        start_node_id="J_KURLA_STN",
        destination_node_id="J_SION_HOSP",
        vehicle_type="AMBULANCE",
        time_minute=0
    )
    # Dry simulation state (0cm depth)
    sim_dry = {"roads": {r["properties"]["road_id"]: {"water_depth_cm": 0.0} for r in dataset.roads["features"]}}
    res = router.plan_route(req, sim_dry)
    
    assert res.safe_route_found == True
    assert res.safe_route_distance_m > 0
    assert res.safe_route_max_depth_cm == 0.0
    assert res.direct_route_is_flooded == False

def test_routing_flooded_avoidance():
    router = FloodAwareRouter(dataset.roads)
    req = RouteRequest(
        start_node_id="J_KURLA_STN",
        destination_node_id="J_SION_HOSP",
        vehicle_type="AMBULANCE",
        time_minute=40
    )
    # Submerge direct LBS Marg (R_LBS_01, R_LBS_02) with 45cm depth (Ambulance limit is 20cm)
    sim_flooded = {"roads": {
        "R_LBS_01": {"water_depth_cm": 45.0, "risk_level": "CRITICAL"},
        "R_LBS_02": {"water_depth_cm": 50.0, "risk_level": "CRITICAL"},
        # Other roads stay dry or shallow (< 10cm)
        "R_NEHRU_01": {"water_depth_cm": 2.0, "risk_level": "LOW"},
        "R_TILAK_01": {"water_depth_cm": 2.0, "risk_level": "LOW"},
        "R_PREMIER_01": {"water_depth_cm": 2.0, "risk_level": "LOW"},
        "R_PREMIER_02": {"water_depth_cm": 2.0, "risk_level": "LOW"},
        "R_SION_01": {"water_depth_cm": 5.0, "risk_level": "LOW"}
    }}
    res = router.plan_route(req, sim_flooded)
    
    assert res.safe_route_found == True
    assert res.direct_route_is_flooded == True
    assert res.safe_route_max_depth_cm <= 20.0  # Safe route stayed within ambulance clearance
    assert "REROUTE ACTIVATED" in res.reroute_justification
