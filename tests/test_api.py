import pytest
import sys
import os
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend"))

from app.main import app

client = TestClient(app)

def test_api_health():
    res = client.get("/api/data/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "OPERATIONAL"
    assert data["roads_count"] > 0

def test_api_data_provenance():
    res = client.get("/api/data/provenance")
    assert res.status_code == 200
    layers = res.json()
    assert len(layers) >= 4
    classifications = [l["classification"] for l in layers]
    assert any("REAL_PUBLIC_DATA" in c for c in classifications)
    assert any("SIMULATED_DATA" in c for c in classifications)

def test_api_simulation_run():
    payload = {
        "scenario_id": "cloudburst_emergency_120mm",
        "rainfall_intensity_multiplier": 1.0,
        "blockage_percentage": 20.0,
        "conduit_capacity_multiplier": 1.0,
        "horizon_minutes": 60,
        "time_step_min": 10
    }
    res = client.post("/api/simulation/run", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "timeline" in data
    assert len(data["timeline"]) == 7

def test_api_explainability():
    res = client.get("/api/simulation/explain/R_LBS_01?time_min=40")
    assert res.status_code == 200
    data = res.json()
    assert data["target_id"] == "R_LBS_01"
    assert len(data["factors"]) > 0
    assert "scientific_summary" in data

def test_api_routing_plan():
    payload = {
        "start_node_id": "J_KURLA_STN",
        "destination_node_id": "J_SION_HOSP",
        "vehicle_type": "AMBULANCE",
        "time_minute": 40
    }
    res = client.post("/api/route/plan", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "safe_route_found" in data
    assert "vehicle_clearance_cm" in data
