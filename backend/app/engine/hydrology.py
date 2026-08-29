"""
Module: hydrology.py
Purpose: Hydrologic runoff calculations and spatial rainfall nowcast distribution.
Equations:
  - Modified Rational Method Runoff Generation:
      Q_runoff (m^3/s) = (C * (I_mm_hr / 1000.0) * Area_m2) / 3600.0
  - Spatial Gaussian Storm Cell Decay:
      I(x,y) = I_peak * exp(- distance^2 / (2 * sigma^2))
"""

import math

def calculate_surface_runoff(
    rainfall_intensity_mmh: float,
    tributary_area_m2: float,
    imperviousness_c: float
) -> float:
    """
    Calculates surface runoff volumetric rate in m^3/s.
    C is the runoff coefficient (0.75 - 0.95 for urban paved surfaces).
    """
    if rainfall_intensity_mmh <= 0.0 or tributary_area_m2 <= 0.0:
        return 0.0
    
    # Q (m^3/s) = C * (I / 1000 m/hr) * Area / 3600 s/hr
    q_runoff = (imperviousness_c * (rainfall_intensity_mmh / 1000.0) * tributary_area_m2) / 3600.0
    return max(0.0, round(q_runoff, 4))

def spatial_rainfall_at_point(
    lat: float,
    lon: float,
    storm_center_lat: float,
    storm_center_lon: float,
    peak_intensity_mmh: float,
    storm_radius_km: float = 2.5
) -> float:
    """
    Computes local rainfall intensity at (lat, lon) given convective storm center.
    Uses Haversine distance and Gaussian spatial decay.
    """
    if peak_intensity_mmh <= 0.0:
        return 0.0
        
    R = 6371.0  # km
    dlat = math.radians(lat - storm_center_lat)
    dlon = math.radians(lon - storm_center_lon)
    a = math.sin(dlat/2.0)**2 + math.cos(math.radians(storm_center_lat)) * math.cos(math.radians(lat)) * math.sin(dlon/2.0)**2
    dist_km = 2.0 * R * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    
    # Gaussian bell curve distribution
    sigma = max(0.5, storm_radius_km)
    intensity = peak_intensity_mmh * math.exp(-(dist_km ** 2) / (2.0 * (sigma ** 2)))
    
    # Background monsoon drizzle factor (minimum 10% of peak within basin)
    intensity = max(intensity, peak_intensity_mmh * 0.12)
    return round(intensity, 2)
