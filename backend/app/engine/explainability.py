"""
Module: explainability.py
Purpose: Explainable AI & Hydrology Diagnostics ("Why is this area flooding?").
Provides transparent causal factor decomposition for decision-makers.
"""

from typing import Dict, Any, List
from app.models.schemas import FloodExplainResponse, ExplainFactor

def explain_road_flooding(
    road_id: str,
    road_data: Dict[str, Any],
    simulation_state_at_t: Dict[str, Any],
    time_min: int
) -> FloodExplainResponse:
    """
    Generates causal decomposition and explanation for why a specific road is flooded at time t.
    """
    road_info = road_data.get(road_id, {})
    road_name = road_info.get("name", road_id)
    
    # Retrieve current simulation state for this road
    road_sim = simulation_state_at_t.get("roads", {}).get(road_id, {})
    water_depth = road_sim.get("water_depth_cm", 0.0)
    risk_level = road_sim.get("risk_level", "LOW")
    peak_depth = road_sim.get("peak_depth_cm", water_depth)
    time_to_peak = road_sim.get("time_to_peak_min", 40)
    rainfall_mmh = road_sim.get("rainfall_intensity_mmh", 0.0)
    surcharge_m3s = road_sim.get("surcharge_m3s", 0.0)
    drain_util = road_sim.get("drainage_utilization_pct", 50.0)
    base_elev = road_info.get("base_elev_m", 3.5)
    slope_pct = road_info.get("slope_pct", 1.0)
    
    factors: List[ExplainFactor] = []
    
    if water_depth <= 2.0:
        factors.append(ExplainFactor(
            factor_name="Adequate Drainage & Elevated Topography",
            percentage=100.0,
            description="Drainage conduits are conveying surface runoff efficiently without surcharge.",
            severity="NORMAL"
        ))
        summary = f"{road_name} is operating normally with negligible water accumulation ({water_depth:.1f} cm)."
    else:
        # Calculate raw weights
        w_rain = min(100.0, (rainfall_mmh / 100.0) * 40.0)
        w_topo = max(0.0, (6.0 - base_elev) / 4.0 * 25.0) if base_elev < 6.0 else 5.0
        w_drain_overload = min(30.0, (drain_util / 100.0) * 20.0)
        w_surcharge = min(35.0, surcharge_m3s * 25.0) if surcharge_m3s > 0 else 0.0
        w_impervious = road_info.get("imperviousness", 0.85) * 15.0
        
        total_raw = w_rain + w_topo + w_drain_overload + w_surcharge + w_impervious
        
        f_rain_pct = round((w_rain / total_raw) * 100.0, 1)
        f_topo_pct = round((w_topo / total_raw) * 100.0, 1)
        f_drain_pct = round((w_drain_overload / total_raw) * 100.0, 1)
        f_surch_pct = round((w_surcharge / total_raw) * 100.0, 1)
        f_imperv_pct = round(100.0 - (f_rain_pct + f_topo_pct + f_drain_pct + f_surch_pct), 1)
        
        factors.append(ExplainFactor(
            factor_name="Convective Rainfall Intensity",
            percentage=f_rain_pct,
            description=f"High precipitation rate of {rainfall_mmh:.1f} mm/hr exceeding base infiltration threshold.",
            severity="HIGH" if rainfall_mmh > 50 else "MODERATE"
        ))
        
        factors.append(ExplainFactor(
            factor_name="Topographic Low-Point Depression",
            percentage=f_topo_pct,
            description=f"Road base elevation ({base_elev:.1f}m) forms a natural catchment basin collecting runoff from surrounding slopes ({slope_pct:.1f}% gradient).",
            severity="CRITICAL" if base_elev < 3.0 else "MODERATE"
        ))
        
        if f_surch_pct > 0:
            factors.append(ExplainFactor(
                factor_name="Drainage Surcharge & Backflow",
                percentage=f_surch_pct,
                description=f"Underground trunk drain capacity exceeded by {surcharge_m3s:.2f} m³/s, causing hydraulic water to reverse out of manholes onto the pavement.",
                severity="CRITICAL"
            ))
            
        factors.append(ExplainFactor(
            factor_name="Stormwater Conduit Saturation",
            percentage=f_drain_pct,
            description=f"Local drop inlet and connecting pipes operating at {drain_util:.1f}% utilization capacity.",
            severity="HIGH" if drain_util > 90 else "MODERATE"
        ))
        
        factors.append(ExplainFactor(
            factor_name="Urban Impervious Surface Fraction",
            percentage=f_imperv_pct,
            description=f"Dense concrete/asphalt cover ({road_info.get('imperviousness', 0.85)*100:.0f}%) generates rapid flash overland runoff.",
            severity="MODERATE"
        ))
        
        summary = (
            f"{road_name} is experiencing {risk_level} flooding ({water_depth:.1f} cm). "
            f"Primary causes: intense localized precipitation ({rainfall_mmh:.1f} mm/hr), "
            f"low-lying terrain elevation ({base_elev:.1f}m), and drainage conduit saturation "
            f"({drain_util:.1f}% utilization" + (f" with active surcharge of {surcharge_m3s:.2f} m³/s)." if surcharge_m3s > 0 else ").")
        )

    return FloodExplainResponse(
        target_id=road_id,
        target_name=road_name,
        target_type="road",
        time_minute=time_min,
        water_depth_cm=round(water_depth, 1),
        risk_level=risk_level,
        peak_depth_cm=round(peak_depth, 1),
        time_to_peak_min=time_to_peak,
        factors=factors,
        drainage_status={
            "drainage_node_id": road_info.get("drainage_node_id", "N/A"),
            "utilization_pct": round(drain_util, 1),
            "surcharge_m3s": round(surcharge_m3s, 3),
            "base_elev_m": base_elev
        },
        scientific_summary=summary
    )
