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

def test_normal_route_follows_real_roads():
    router = FloodAwareRouter(dataset.roads)
    req = RouteRequest(
        start_node_id="J_KURLA_STN",
        destination_node_id="J_SION_HOSP",
        vehicle_type="AMBULANCE",
        time_minute=0
    )
    sim_dry = {"roads": {r["properties"]["road_id"]: {"water_depth_cm": 0.0} for r in dataset.roads["features"]}}
    res = router.plan_route(req, sim_dry)

    assert res.safe_route_found is True
    assert len(res.safe_route_segments) > 0

    # Ensure every segment belongs to valid OSM road edges and has continuous node connections
    for i in range(len(res.safe_route_segments) - 1):
        curr_seg = res.safe_route_segments[i]
        next_seg = res.safe_route_segments[i + 1]
        assert curr_seg.to_node == next_seg.from_node
        assert len(curr_seg.coordinates) >= 2

def test_route_around_building_follows_available_roads():
    router = FloodAwareRouter(dataset.roads)
    req = RouteRequest(
        start_node_id="J_KURLA_STN",
        destination_node_id="J_SION_HOSP",
        vehicle_type="AMBULANCE",
        time_minute=15
    )
    # Block direct LBS road
    sim_blocked = {"roads": {
        "R_LBS_01": {"water_depth_cm": 80.0, "risk_level": "CRITICAL"},
        "R_LBS_02": {"water_depth_cm": 80.0, "risk_level": "CRITICAL"}
    }}
    res = router.plan_route(req, sim_blocked)

    assert res.safe_route_found is True
    road_ids = [s.road_id for s in res.safe_route_segments]
    # Rerouted detour via Nehru / Tilak / Premier bypass around municipal blocks
    assert "R_NEHRU_01" in road_ids or "R_CST_01" in road_ids
    assert "R_LBS_01" not in road_ids

def test_flooded_roads_cause_safe_rerouting():
    router = FloodAwareRouter(dataset.roads)
    req = RouteRequest(
        start_node_id="J_KURLA_STN",
        destination_node_id="J_SION_HOSP",
        vehicle_type="AMBULANCE",
        time_minute=30
    )
    sim_flooded = {"roads": {
        "R_LBS_01": {"water_depth_cm": 50.0, "risk_level": "CRITICAL"},
        "R_LBS_02": {"water_depth_cm": 50.0, "risk_level": "CRITICAL"},
        "R_NEHRU_01": {"water_depth_cm": 0.0, "risk_level": "LOW"},
        "R_TILAK_01": {"water_depth_cm": 0.0, "risk_level": "LOW"},
        "R_PREMIER_01": {"water_depth_cm": 0.0, "risk_level": "LOW"},
        "R_PREMIER_02": {"water_depth_cm": 0.0, "risk_level": "LOW"},
        "R_SION_01": {"water_depth_cm": 0.0, "risk_level": "LOW"}
    }}
    res = router.plan_route(req, sim_flooded)

    assert res.safe_route_found is True
    assert res.direct_route_is_flooded is True
    assert res.safe_route_max_depth_cm == 0.0
    assert "REROUTE ACTIVATED" in res.reroute_justification

def test_no_straight_line_shortcuts_appear():
    router = FloodAwareRouter(dataset.roads)

    # 1. Test coordinate snapping to nearest valid road graph node
    snapped_node, coords = router.snap_to_valid_node([72.879, 19.066])
    assert snapped_node in router.road_nodes
    assert coords == router.road_nodes[snapped_node]

    # 2. Test disconnected start and destination nodes return 'No valid road-network route found'
    disconnected_geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": [[72.8, 19.0], [72.81, 19.01]]},
                "properties": {"road_id": "ISO_1", "name": "Isolated 1", "from_node": "J_ISO_1", "to_node": "J_ISO_2", "length_m": 100}
            },
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": [[72.9, 19.1], [72.91, 19.11]]},
                "properties": {"road_id": "ISO_2", "name": "Isolated 2", "from_node": "J_ISO_3", "to_node": "J_ISO_4", "length_m": 100}
            }
        ]
    }
    iso_router = FloodAwareRouter(disconnected_geojson)
    req = RouteRequest(start_node_id="J_ISO_1", destination_node_id="J_ISO_4", vehicle_type="AMBULANCE", time_minute=0)
    res = iso_router.plan_route(req, {"roads": {}})

    assert res.safe_route_found is False
    assert res.reroute_justification == "No valid road-network route found"
    assert len(res.safe_route_segments) == 0
