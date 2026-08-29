import pytest
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend"))

from app.engine.hydraulic import calculate_manning_capacity, apply_blockage_and_tide, calculate_conduit_velocity

def test_manning_capacity_basic():
    # 1000mm diameter pipe, 1% slope (0.01), roughness 0.013
    cap = calculate_manning_capacity(diameter_mm=1000.0, slope_m_per_m=0.01, roughness_n=0.013)
    assert cap > 1.0  # Should be ~1.89 m3/s
    assert isinstance(cap, float)

def test_manning_capacity_slope_scaling():
    # Steeper slope should yield higher capacity
    cap_flat = calculate_manning_capacity(diameter_mm=800.0, slope_m_per_m=0.002, roughness_n=0.013)
    cap_steep = calculate_manning_capacity(diameter_mm=800.0, slope_m_per_m=0.020, roughness_n=0.013)
    assert cap_steep > cap_flat

def test_blockage_degradation():
    base_cap = 5.0
    cap_unblocked = apply_blockage_and_tide(base_cap, blockage_pct=0.0, invert_elev_m=3.0)
    cap_50_pct = apply_blockage_and_tide(base_cap, blockage_pct=50.0, invert_elev_m=3.0)
    cap_80_pct = apply_blockage_and_tide(base_cap, blockage_pct=80.0, invert_elev_m=3.0)
    
    assert cap_unblocked == base_cap
    assert cap_50_pct < cap_unblocked
    assert cap_80_pct < cap_50_pct
    # At 50% blockage, effective capacity is (1 - 0.5)^1.5 = 0.3535 * base_cap
    assert round(cap_50_pct / base_cap, 2) == 0.35

def test_tidal_outfall_submergence():
    base_cap = 10.0
    # Outfall invert at 1.0m, tide at 3.0m (submerged)
    cap_submerged = apply_blockage_and_tide(base_cap, blockage_pct=0.0, invert_elev_m=1.0, tide_level_m=3.0, is_outfall=True)
    assert cap_submerged < base_cap

def test_conduit_velocity():
    vel = calculate_conduit_velocity(flow_m3s=1.5, diameter_mm=1000.0)
    assert vel > 0.0
    assert vel < 10.0  # Physically realistic urban drainage velocity
