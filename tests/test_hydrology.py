import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend"))

from app.engine.hydrology import calculate_surface_runoff, spatial_rainfall_at_point

def test_runoff_calculation_zero_rain():
    q = calculate_surface_runoff(rainfall_intensity_mmh=0.0, tributary_area_m2=5000.0, imperviousness_c=0.9)
    assert q == 0.0

def test_runoff_calculation_scaling():
    # 100 mm/hr on 10,000 m2 with C=0.9
    # Q = 0.9 * (100/1000) * 10000 / 3600 = 0.25 m3/s
    q = calculate_surface_runoff(rainfall_intensity_mmh=100.0, tributary_area_m2=10000.0, imperviousness_c=0.9)
    assert abs(q - 0.25) < 0.01

def test_spatial_rainfall_decay():
    storm_center = (19.070, 72.870)
    # At epicenter
    i_center = spatial_rainfall_at_point(19.070, 72.870, storm_center[0], storm_center[1], peak_intensity_mmh=100.0)
    # 2 km away
    i_distant = spatial_rainfall_at_point(19.090, 72.890, storm_center[0], storm_center[1], peak_intensity_mmh=100.0)
    
    assert i_center >= 90.0
    assert i_distant < i_center
