"""
Module: hydraulic.py
Purpose: Hydraulic calculations for stormwater conduits and drainage nodes.
Equations:
  - Manning's Equation for Gravity Flow:
      Q = (1/n) * A * (R_h)^(2/3) * S^(1/2)
  - Non-Linear Blockage Capacity Reduction:
      Q_eff = Q_base * (1 - blockage_ratio)^1.5
  - Outfall Tidal Backwater Head Attenuation:
      Q_tide_adjusted = Q_eff * eta_tide
"""

import math

def calculate_manning_capacity(diameter_mm: float, slope_m_per_m: float, roughness_n: float = 0.013) -> float:
    """
    Computes theoretical full-pipe gravity flow capacity in m^3/s using Manning's formula.
    """
    D_m = diameter_mm / 1000.0
    A = math.pi * (D_m ** 2) / 4.0
    R_h = D_m / 4.0
    s_clean = max(0.0005, slope_m_per_m)
    n_clean = max(0.009, roughness_n)
    
    Q = (1.0 / n_clean) * A * (R_h ** (2.0 / 3.0)) * math.sqrt(s_clean)
    return max(0.01, round(Q, 4))

def apply_blockage_and_tide(
    base_capacity_m3s: float,
    blockage_pct: float,
    invert_elev_m: float,
    tide_level_m: float = 2.4,
    is_outfall: bool = False
) -> float:
    """
    Calculates effective conduit hydraulic capacity considering silt/debris blockage
    and downstream tidal boundary head.
    """
    blockage_ratio = min(0.95, max(0.0, blockage_pct / 100.0))
    # Hydraulic area constriction and friction factor increase yields ~ (1 - beta)^1.5
    eff_capacity = base_capacity_m3s * math.pow(1.0 - blockage_ratio, 1.5)
    
    # Tidal backwater head reduction at outfalls
    if is_outfall:
        water_head_diff = invert_elev_m - tide_level_m
        if water_head_diff < 0:
            # Submerged outfall under high tide
            submergence_depth = abs(water_head_diff)
            tide_factor = max(0.15, 1.0 - (submergence_depth / 2.5))
            eff_capacity *= tide_factor
            
    return max(0.005, round(eff_capacity, 4))

def calculate_conduit_velocity(flow_m3s: float, diameter_mm: float) -> float:
    """
    Calculates cross-sectional flow velocity in m/s.
    """
    D_m = diameter_mm / 1000.0
    A = math.pi * (D_m ** 2) / 4.0
    return round(flow_m3s / max(A, 0.01), 2)
