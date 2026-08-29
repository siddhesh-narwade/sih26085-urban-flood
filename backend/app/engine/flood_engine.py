"""
Module: flood_engine.py
Purpose: Main 0-3 Hour Flood Nowcasting Simulation Engine.
Couples spatial rainfall nowcasting, DEM surface routing, and underground drainage hydraulics.
"""

import json
import math
import time
from typing import Dict, Any, List, Optional
from app.config import settings
from app.models.schemas import SimulationRequest
from app.engine.hydrology import calculate_surface_runoff, spatial_rainfall_at_point
from app.engine.drainage_graph import DrainageGraphEngine
from app.engine.surface_flow import SurfaceFlowEngine
from app.engine.risk_engine import evaluate_flood_risk

class FloodNowcastEngine:
    def __init__(self, roads_geojson: Dict[str, Any], drainage_nodes_geojson: Dict[str, Any], drainage_edges_geojson: Dict[str, Any], dem_payload: Dict[str, Any], scenarios_dict: Dict[str, Any]):
        self.roads_geojson = roads_geojson
        self.drainage_nodes_geojson = drainage_nodes_geojson
        self.drainage_edges_geojson = drainage_edges_geojson
        self.dem_payload = dem_payload
        self.scenarios_dict = scenarios_dict
        
        self.roads_dict = {}
        for f in roads_geojson.get("features", []):
            p = f["properties"]
            self.roads_dict[p["road_id"]] = {
                **p,
                "coordinates": f["geometry"]["coordinates"]
            }
            
        self.drainage_engine = DrainageGraphEngine(drainage_nodes_geojson, drainage_edges_geojson)
        self.surface_engine = SurfaceFlowEngine(dem_payload)
        
        # Cache for latest simulation run
        self.latest_simulation_result: Optional[Dict[str, Any]] = None

    def run_nowcast_simulation(self, request: SimulationRequest) -> Dict[str, Any]:
        """
        Executes full 0-3hr nowcasting simulation across all time steps.
        """
        start_exec_time = time.time()
        
        # Load base scenario profile
        scenario_id = request.scenario_id or "cloudburst_emergency_120mm"
        scenario = self.scenarios_dict.get(scenario_id, self.scenarios_dict.get("cloudburst_emergency_120mm"))
        
        peak_intensity = scenario["peak_intensity_mmh"] * request.rainfall_intensity_multiplier
        blockage_pct = request.blockage_percentage
        capacity_mult = request.conduit_capacity_multiplier
        tide_level = request.tide_level_m
        horizon_min = request.horizon_minutes
        dt_min = request.time_step_min
        dt_sec = dt_min * 60.0

        # Build timeline steps
        time_steps = list(range(0, horizon_min + 1, dt_min))
        
        # Track road water volumes for mass-conservation: {road_id: volume_m3}
        current_road_volumes = {r_id: 0.0 for r_id in self.roads_dict}
        road_peaks = {r_id: {"peak_depth_cm": 0.0, "time_to_peak_min": 0} for r_id in self.roads_dict}
        
        timeline_results = []
        alerts_list = []
        prev_depths = {r_id: 0.0 for r_id in self.roads_dict}

        for t_min in time_steps:
            profile = scenario["timeline_profile"]
            closest_wp = min(profile, key=lambda x: abs(x["t_min"] - t_min))
            intensity_pct = closest_wp["intensity_pct"]
            storm_center = closest_wp["storm_center"]
            curr_peak_intensity = peak_intensity * intensity_pct

            # 1. Compute rainfall intensity at each road segment midpoint
            road_rainfalls = {}
            road_runoffs_m3s = {}
            inlet_inflows = {n_id: 0.0 for n_id in self.drainage_engine.nodes_data}

            for r_id, r_info in self.roads_dict.items():
                coords = r_info["coordinates"]
                mid_lon = (coords[0][0] + coords[1][0]) / 2.0
                mid_lat = (coords[0][1] + coords[1][1]) / 2.0
                
                local_rain = spatial_rainfall_at_point(
                    lat=mid_lat,
                    lon=mid_lon,
                    storm_center_lat=storm_center[0],
                    storm_center_lon=storm_center[1],
                    peak_intensity_mmh=curr_peak_intensity
                )
                road_rainfalls[r_id] = local_rain
                
                # Surface runoff generation
                q_runoff = calculate_surface_runoff(
                    rainfall_intensity_mmh=local_rain,
                    tributary_area_m2=r_info["tributary_area_m2"],
                    imperviousness_c=r_info["imperviousness"]
                )
                road_runoffs_m3s[r_id] = q_runoff
                
                # Route portion of runoff directly into drainage drop inlet
                inlet_id = r_info.get("drainage_node_id")
                if inlet_id and inlet_id in inlet_inflows:
                    # In standard urban design, inlets capture up to ~75% of approach flow before gutter bypass
                    inlet_inflows[inlet_id] += q_runoff * 0.80

            # 2. Hydraulic Drainage Network Solution
            node_hydraulics, edge_hydraulics = self.drainage_engine.solve_hydraulic_flow(
                inlet_inflows_m3s=inlet_inflows,
                blockage_pct=blockage_pct,
                conduit_capacity_mult=capacity_mult,
                tide_level_m=tide_level
            )

            # 3. Dynamic Street-Level Water Depth Update
            road_step_data = {}
            for r_id, r_info in self.roads_dict.items():
                q_runoff = road_runoffs_m3s[r_id]
                inlet_id = r_info.get("drainage_node_id")
                base_elev = r_info["base_elev_m"]
                
                node_stat = node_hydraulics.get(inlet_id, {})
                surcharge_m3s = node_stat.get("surcharge_m3s", 0.0)
                is_surcharged = node_stat.get("is_surcharged", False)
                
                # Interception & Surface ponding
                # If inlet is surcharged, zero flow is drained and surcharge spills back
                if is_surcharged:
                    q_captured = 0.0
                    q_net_inflow = q_runoff + (surcharge_m3s * 0.90)
                else:
                    inlet_cap = self.drainage_engine.nodes_data.get(inlet_id, {}).get("grate_capacity_m3s", 2.0)
                    # Grate capture limit & gutter bypass (20% overland gutter flow)
                    q_captured = min(q_runoff * 0.80, inlet_cap)
                    q_net_inflow = max(0.0, q_runoff - q_captured)

                # Low-elevation overland accumulation bonus:
                # Topographic runoff drains down from surrounding higher ridges (< 4m gets extra overland flow)
                if base_elev < 4.0 and curr_peak_intensity > 10.0:
                    topo_inflow = (4.5 - base_elev) * (curr_peak_intensity / 100.0) * 0.04
                    q_net_inflow += topo_inflow

                # Natural recession / surface dissipation
                # Water drains down slopes unless in lowest bowl
                drain_rate = 0.015 if base_elev > 4.0 else 0.005
                q_recession = drain_rate if current_road_volumes[r_id] > 0 else 0.0
                
                delta_vol = (q_net_inflow - q_recession) * dt_sec
                current_road_volumes[r_id] = max(0.0, current_road_volumes[r_id] + delta_vol)
                
                surf_area = r_info["surface_area_m2"]
                # Low-elevation pooling factor
                elev_pool_factor = max(0.7, 1.5 - (base_elev / 8.0))
                depth_cm = (current_road_volumes[r_id] / max(surf_area, 1.0)) * 100.0 * elev_pool_factor
                depth_cm = round(max(0.0, depth_cm), 1)

                if depth_cm > road_peaks[r_id]["peak_depth_cm"]:
                    road_peaks[r_id]["peak_depth_cm"] = depth_cm
                    road_peaks[r_id]["time_to_peak_min"] = t_min

                rate_rise = round(depth_cm - prev_depths[r_id], 1)
                prev_depths[r_id] = depth_cm

                # Find associated drainage utilization
                util_pct = 40.0
                for e_res in edge_hydraulics.values():
                    if e_res["from_node"] == inlet_id:
                        util_pct = e_res["utilization_pct"]
                        break

                risk_lvl, risk_score, risk_tag = evaluate_flood_risk(
                    water_depth_cm=depth_cm,
                    rate_of_rise_cm_per_10min=rate_rise,
                    road_criticality=r_info["criticality"],
                    drainage_utilization_pct=util_pct,
                    base_elev_m=r_info["base_elev_m"]
                )

                road_step_data[r_id] = {
                    "road_id": r_id,
                    "name": r_info["name"],
                    "water_depth_cm": depth_cm,
                    "rainfall_intensity_mmh": road_rainfalls[r_id],
                    "runoff_m3s": round(q_runoff, 3),
                    "surcharge_m3s": round(surcharge_m3s, 3),
                    "drainage_utilization_pct": util_pct,
                    "risk_level": risk_lvl,
                    "risk_score": risk_score,
                    "risk_tag": risk_tag,
                    "is_passable_standard": depth_cm < 15.0,
                    "is_passable_ambulance": depth_cm < 20.0,
                    "is_passable_fire": depth_cm < 45.0,
                    "peak_depth_cm": road_peaks[r_id]["peak_depth_cm"],
                    "time_to_peak_min": road_peaks[r_id]["time_to_peak_min"]
                }

                if risk_lvl == "CRITICAL" and t_min in [20, 40, 60, 90]:
                    alert_key = f"{r_id}_{t_min}"
                    alerts_list.append({
                        "id": alert_key,
                        "time_min": t_min,
                        "severity": "CRITICAL",
                        "target_name": r_info["name"],
                        "message": f"CRITICAL: {r_info['name']} projected at {depth_cm} cm flood depth at t={t_min}m (Drainage Node {inlet_id} Surcharging)."
                    })

            timeline_results.append({
                "time_minute": t_min,
                "storm_center": storm_center,
                "current_rainfall_peak_mmh": round(curr_peak_intensity, 1),
                "roads": road_step_data,
                "drainage_nodes": node_hydraulics,
                "drainage_edges": edge_hydraulics
            })

        exec_duration_ms = round((time.time() - start_exec_time) * 1000, 1)

        result_payload = {
            "metadata": {
                "scenario_id": scenario_id,
                "scenario_title": scenario["title"],
                "scenario_base_intensity_mmh": scenario["peak_intensity_mmh"],
                "rainfall_intensity_multiplier": request.rainfall_intensity_multiplier,
                "applied_peak_intensity_mmh": round(scenario["peak_intensity_mmh"] * request.rainfall_intensity_multiplier, 1),
                "execution_time_ms": exec_duration_ms,
                "total_timesteps": len(time_steps),
                "horizon_minutes": horizon_min,
                "time_step_min": dt_min,
                "blockage_percentage": blockage_pct,
                "conduit_capacity_multiplier": capacity_mult,
                "tide_level_m": tide_level,
                "generated_at": time.strftime("%Y-%m-%d %H:%M:%S")
            },
            "timeline": timeline_results,
            "alerts": alerts_list[:15],
            "peak_summary": {
                "max_depth_cm": max(p["peak_depth_cm"] for p in road_peaks.values()),
                "most_vulnerable_road": max(road_peaks.items(), key=lambda x: x[1]["peak_depth_cm"])[0],
                "total_surcharging_nodes": sum(1 for n in timeline_results[min(4, len(timeline_results)-1)]["drainage_nodes"].values() if n["is_surcharged"])
            }
        }

        self.latest_simulation_result = result_payload
        return result_payload
