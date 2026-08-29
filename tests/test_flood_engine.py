import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend"))

from app.data_loader import dataset
from app.models.schemas import SimulationRequest
from app.engine.flood_engine import FloodNowcastEngine

def test_flood_simulation_run():
    engine = FloodNowcastEngine(
        roads_geojson=dataset.roads,
        drainage_nodes_geojson=dataset.drainage_nodes,
        drainage_edges_geojson=dataset.drainage_edges,
        dem_payload=dataset.dem,
        scenarios_dict=dataset.scenarios
    )
    
    req = SimulationRequest(
        scenario_id="cloudburst_emergency_120mm",
        rainfall_intensity_multiplier=1.0,
        blockage_percentage=25.0,
        horizon_minutes=60,
        time_step_min=10
    )
    
    res = engine.run_nowcast_simulation(req)
    assert "timeline" in res
    assert len(res["timeline"]) == 7  # 0, 10, 20, 30, 40, 50, 60
    assert res["peak_summary"]["max_depth_cm"] > 0
    assert "metadata" in res
    assert res["metadata"]["execution_time_ms"] > 0
