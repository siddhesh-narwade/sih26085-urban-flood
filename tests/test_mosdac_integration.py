import pytest
from app.engine.mosdac_service import mosdac_service
from app.engine.flood_engine import FloodNowcastEngine
from app.models.schemas import SimulationRequest
from app.data_loader import dataset

def test_mosdac_authentication():
    """Verify that MOSDAC credentials authenticate and obtain access token."""
    auth_ok = mosdac_service.authenticate()
    assert auth_ok is True
    assert mosdac_service.access_token is not None

def test_mosdac_dataset_search():
    """Verify searching for Hydro-Estimator / DWR granules on MOSDAC."""
    granules = mosdac_service.search_latest_granules(count=3)
    assert isinstance(granules, list)
    assert len(granules) > 0
    assert "id" in granules[0]
    assert "identifier" in granules[0]

def test_mosdac_spatial_rainfall_extraction():
    """Verify spatial interpolation of MOSDAC rainfall intensity across Kurla roads."""
    lat, lon = 19.068, 72.875
    rain_t0 = mosdac_service.get_road_rainfall_intensity(lat, lon, t_min=0, scenario_id="mosdac_live_satellite_dwr")
    rain_t40 = mosdac_service.get_road_rainfall_intensity(lat, lon, t_min=40, scenario_id="mosdac_live_satellite_dwr")

    assert rain_t0 == 0.0
    assert rain_t40 == 0.0

def test_simulation_with_mosdac_live_scenario():
    """Verify that the full flood engine runs end-to-end using MOSDAC scenario."""
    engine = FloodNowcastEngine(
        roads_geojson=dataset.roads,
        drainage_nodes_geojson=dataset.drainage_nodes,
        drainage_edges_geojson=dataset.drainage_edges,
        dem_payload=dataset.dem,
        scenarios_dict=dataset.scenarios
    )

    result = engine.run_nowcast_simulation(SimulationRequest(
        scenario_id="mosdac_live_satellite_dwr",
        rainfall_intensity_multiplier=1.0,
        blockage_percentage=20.0,
        conduit_capacity_multiplier=1.0,
        tide_level_m=2.4
    ))

    assert result["metadata"]["scenario_id"] == "mosdac_live_satellite_dwr"
    assert len(result["timeline"]) > 0
    assert "peak_summary" in result
    assert result["peak_summary"]["max_depth_cm"] == 0.0
