"""
Module: risk_engine.py
Purpose: Multi-criteria urban flood risk scoring and hazard classification.
"""

from typing import Dict, Any, Tuple

def evaluate_flood_risk(
    water_depth_cm: float,
    rate_of_rise_cm_per_10min: float,
    road_criticality: int = 3,
    drainage_utilization_pct: float = 50.0,
    base_elev_m: float = 4.0
) -> Tuple[str, float, str]:
    """
    Evaluates multi-factor flood risk.
    Returns:
      - risk_level: LOW, MODERATE, HIGH, CRITICAL
      - risk_score: 0.0 - 100.0
      - explanation_tag: Short summary
    """
    if water_depth_cm <= 2.0:
        return "LOW", round(water_depth_cm * 2.0, 1), "Normal traffic flow, minimal ponding"
    
    # 1. Depth score (0-40 pts)
    depth_score = min(40.0, (water_depth_cm / 50.0) * 40.0)
    
    # 2. Rate of rise score (0-20 pts)
    rise_score = min(20.0, max(0.0, rate_of_rise_cm_per_10min / 10.0) * 20.0)
    
    # 3. Road criticality score (0-20 pts)
    crit_score = (road_criticality / 5.0) * 20.0
    
    # 4. Drainage saturation penalty (0-10 pts)
    drain_score = min(10.0, (drainage_utilization_pct / 100.0) * 10.0)
    
    # 5. Low elevation vulnerability (0-10 pts)
    elev_score = max(0.0, (8.0 - min(8.0, base_elev_m)) / 6.0) * 10.0

    total_score = min(100.0, round(depth_score + rise_score + crit_score + drain_score + elev_score, 1))

    if total_score >= 70.0 or water_depth_cm >= 30.0:
        level = "CRITICAL"
        tag = f"CRITICAL HAZARD: {water_depth_cm:.1f} cm depth exceeds emergency safe thresholds"
    elif total_score >= 45.0 or water_depth_cm >= 15.0:
        level = "HIGH"
        tag = f"HIGH HAZARD: {water_depth_cm:.1f} cm water depth impeding standard transit"
    elif total_score >= 25.0 or water_depth_cm >= 5.0:
        level = "MODERATE"
        tag = f"MODERATE CAUTION: {water_depth_cm:.1f} cm localized waterlogging"
    else:
        level = "LOW"
        tag = f"PASSABLE: {water_depth_cm:.1f} cm shallow surface flow"

    return level, total_score, tag
