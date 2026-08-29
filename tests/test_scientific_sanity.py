"""
Module: test_scientific_sanity.py
Purpose: Mandatory SIH 26085 Scientific Sanity Test Suite.
Verifies the 10 deterministic physical, hydrologic, and hydraulic axioms.
"""

import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend"))

from app.data_loader import dataset
from app.models.schemas import SimulationRequest, RouteRequest
from app.engine.flood_engine import FloodNowcastEngine
from app.engine.routing import FloodAwareRouter

@pytest.fixture
def engine():
    return FloodNowcastEngine(
        roads_geojson=dataset.roads,
        drainage_nodes_geojson=dataset.drainage_nodes,
        drainage_edges_geojson=dataset.drainage_edges,
        dem_payload=dataset.dem,
        scenarios_dict=dataset.scenarios
    )

@pytest.fixture
def router():
    return FloodAwareRouter(dataset.roads)

# --- Test 1: No Rainfall ---
def test_sanity_1_no_rainfall(engine):
    """Test 1: Zero rainfall results in zero flood generation and zero surcharge."""
    req = SimulationRequest(
        scenario_id="moderate_monsoon_35mm",
        rainfall_intensity_multiplier=0.0,
        blockage_percentage=0.0,
        horizon_minutes=60,
        time_step_min=10
    )
    res = engine.run_nowcast_simulation(req)
    assert res["peak_summary"]["max_depth_cm"] == 0.0
    for step in res["timeline"]:
        for n_stat in step["drainage_nodes"].values():
            assert n_stat["surcharge_m3s"] == 0.0
            assert n_stat["is_surcharged"] == False

# --- Test 2: Light Rainfall + Strong Drainage ---
def test_sanity_2_light_rain_strong_drainage(engine):
    """Test 2: Light rainfall with clean drainage results in low flood risk and depths < 5 cm."""
    req = SimulationRequest(
        scenario_id="moderate_monsoon_35mm",
        rainfall_intensity_multiplier=0.4,
        blockage_percentage=0.0,
        conduit_capacity_multiplier=1.5,
        horizon_minutes=60,
        time_step_min=10
    )
    res = engine.run_nowcast_simulation(req)
    assert res["peak_summary"]["max_depth_cm"] < 5.0
    for step in res["timeline"]:
        for r_stat in step["roads"].values():
            assert r_stat["risk_level"] in ["LOW", "MODERATE"]

# --- Test 3: Heavy Rainfall + Strong Drainage vs Standard ---
def test_sanity_3_heavy_rain_strong_drainage(engine):
    """Test 3: Higher drainage capacity reduces peak surface water accumulation during heavy rain."""
    req_std = SimulationRequest(
        scenario_id="heavy_monsoon_75mm",
        rainfall_intensity_multiplier=1.0,
        blockage_percentage=0.0,
        conduit_capacity_multiplier=1.0,
        horizon_minutes=60,
        time_step_min=10
    )
    req_strong = SimulationRequest(
        scenario_id="heavy_monsoon_75mm",
        rainfall_intensity_multiplier=1.0,
        blockage_percentage=0.0,
        conduit_capacity_multiplier=2.0,
        horizon_minutes=60,
        time_step_min=10
    )
    res_std = engine.run_nowcast_simulation(req_std)
    res_strong = engine.run_nowcast_simulation(req_strong)
    
    assert res_strong["peak_summary"]["max_depth_cm"] <= res_std["peak_summary"]["max_depth_cm"]

# --- Test 4: Heavy Rainfall + Weak Drainage Surcharge ---
def test_sanity_4_weak_drainage_surcharge(engine):
    """Test 4: Constricted conduits under cloudburst result in detected hydraulic surcharge."""
    req = SimulationRequest(
        scenario_id="cloudburst_emergency_120mm",
        rainfall_intensity_multiplier=1.0,
        blockage_percentage=40.0,
        conduit_capacity_multiplier=0.6,
        horizon_minutes=60,
        time_step_min=10
    )
    res = engine.run_nowcast_simulation(req)
    surcharging_nodes = res["peak_summary"]["total_surcharging_nodes"]
    assert surcharging_nodes > 0

# --- Test 5: Heavy Rainfall + Blockage Exacerbation ---
def test_sanity_5_blockage_exacerbates_flooding(engine):
    """Test 5: Blockage strictly increases peak water depth and surcharge."""
    req_clean = SimulationRequest(
        scenario_id="cloudburst_emergency_120mm",
        blockage_percentage=0.0,
        horizon_minutes=60,
        time_step_min=10
    )
    req_blocked = SimulationRequest(
        scenario_id="cloudburst_emergency_120mm",
        blockage_percentage=60.0,
        horizon_minutes=60,
        time_step_min=10
    )
    res_clean = engine.run_nowcast_simulation(req_clean)
    res_blocked = engine.run_nowcast_simulation(req_blocked)
    
    assert res_blocked["peak_summary"]["max_depth_cm"] > res_clean["peak_summary"]["max_depth_cm"]

# --- Test 6: Topographic Depression Preference ---
def test_sanity_6_low_elevation_accumulation(engine):
    """Test 6: Low elevation roads (Kurla LBS) pool deeper water than elevated ridge roads."""
    req = SimulationRequest(
        scenario_id="heavy_monsoon_75mm",
        horizon_minutes=60,
        time_step_min=10
    )
    res = engine.run_nowcast_simulation(req)
    step_40 = res["timeline"][4]  # t=40 min peak
    
    # R_LBS_01 is in 2.8m depression, R_KALINA_01 is at 8.9m ridge
    depth_depression = step_40["roads"]["R_LBS_01"]["water_depth_cm"]
    depth_ridge = step_40["roads"]["R_KALINA_01"]["water_depth_cm"]
    
    assert depth_depression > depth_ridge

# --- Test 7: Capacity Sensitivity ---
def test_sanity_7_capacity_scaling(engine):
    """Test 7: 2x drainage capacity strictly reduces peak depth compared to 0.5x capacity."""
    req_low = SimulationRequest(scenario_id="heavy_monsoon_75mm", conduit_capacity_multiplier=0.5, horizon_minutes=60)
    req_high = SimulationRequest(scenario_id="heavy_monsoon_75mm", conduit_capacity_multiplier=2.0, horizon_minutes=60)
    
    res_low = engine.run_nowcast_simulation(req_low)
    res_high = engine.run_nowcast_simulation(req_high)
    
    assert res_high["peak_summary"]["max_depth_cm"] < res_low["peak_summary"]["max_depth_cm"]

# --- Test 8: Flooded Road Avoidance in Routing ---
def test_sanity_8_routing_flood_avoidance(router):
    """Test 8: Router avoids submerged road segments when alternative path exists."""
    req = RouteRequest(
        start_node_id="J_KURLA_STN",
        destination_node_id="J_SION_HOSP",
        vehicle_type="AMBULANCE",
        time_minute=40
    )
    sim_flooded = {
        "roads": {
            "R_LBS_01": {"water_depth_cm": 45.0, "risk_level": "CRITICAL"},
            "R_LBS_02": {"water_depth_cm": 50.0, "risk_level": "CRITICAL"},
            "R_NEHRU_01": {"water_depth_cm": 2.0, "risk_level": "LOW"},
            "R_TILAK_01": {"water_depth_cm": 2.0, "risk_level": "LOW"},
            "R_PREMIER_01": {"water_depth_cm": 2.0, "risk_level": "LOW"},
            "R_PREMIER_02": {"water_depth_cm": 2.0, "risk_level": "LOW"},
            "R_SION_01": {"water_depth_cm": 4.0, "risk_level": "LOW"}
        }
    }
    plan = router.plan_route(req, sim_flooded)
    assert plan.safe_route_found == True
    assert plan.direct_route_is_flooded == True
    # Safe route segments must not include flooded R_LBS_01 or R_LBS_02
    safe_road_ids = [seg.road_id for seg in plan.safe_route_segments]
    assert "R_LBS_01" not in safe_road_ids
    assert "R_LBS_02" not in safe_road_ids

# --- Test 9: Monotonic Rainfall Scaling ---
def test_sanity_9_monotonic_rainfall_scaling(engine):
    """Test 9: Increasing rainfall multiplier monotonically increases peak depth."""
    multipliers = [0.5, 1.0, 1.5, 2.0]
    peak_depths = []
    
    for m in multipliers:
        req = SimulationRequest(
            scenario_id="moderate_monsoon_35mm",
            rainfall_intensity_multiplier=m,
            horizon_minutes=60
        )
        res = engine.run_nowcast_simulation(req)
        peak_depths.append(res["peak_summary"]["max_depth_cm"])

    for i in range(len(peak_depths) - 1):
        assert peak_depths[i+1] >= peak_depths[i]

# --- Test 10: Progressive Blockage Performance Deterioration ---
def test_sanity_10_progressive_blockage(engine):
    """Test 10: Progressive blockage (0% to 80%) leads to monotonic increase in peak water depth."""
    blockage_levels = [0.0, 20.0, 40.0, 60.0, 80.0]
    peak_depths = []
    
    for b in blockage_levels:
        req = SimulationRequest(
            scenario_id="heavy_monsoon_75mm",
            blockage_percentage=b,
            horizon_minutes=60
        )
        res = engine.run_nowcast_simulation(req)
        peak_depths.append(res["peak_summary"]["max_depth_cm"])

    for i in range(len(peak_depths) - 1):
        assert peak_depths[i+1] >= peak_depths[i]
