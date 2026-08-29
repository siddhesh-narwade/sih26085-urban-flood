"""
Module: drainage_graph.py
Purpose: NetworkX-backed directed hydraulic drainage graph engine.
Manages topological sorting, flow convergence, pipe utilization, and surcharge estimation.
"""

import json
import networkx as nx
from typing import Dict, Any, List, Tuple
from app.engine.hydraulic import calculate_manning_capacity, apply_blockage_and_tide, calculate_conduit_velocity

class DrainageGraphEngine:
    def __init__(self, nodes_geojson: Dict[str, Any], edges_geojson: Dict[str, Any]):
        self.graph = nx.DiGraph()
        self.nodes_data = {}
        self.edges_data = {}
        self._build_graph(nodes_geojson, edges_geojson)

    def _build_graph(self, nodes_geojson: Dict[str, Any], edges_geojson: Dict[str, Any]):
        for f in nodes_geojson.get("features", []):
            props = f["properties"]
            geom = f["geometry"]
            node_id = props["node_id"]
            self.nodes_data[node_id] = {
                "id": node_id,
                "name": props["name"],
                "type": props["node_type"],
                "invert_elev_m": props["invert_elev_m"],
                "grate_capacity_m3s": props.get("grate_capacity_m3s", 0.0),
                "tidal_head_m": props.get("tidal_head_m", 0.0),
                "coordinates": geom["coordinates"]
            }
            self.graph.add_node(node_id, **self.nodes_data[node_id])

        for f in edges_geojson.get("features", []):
            props = f["properties"]
            geom = f["geometry"]
            edge_id = props["edge_id"]
            u, v = props["from_node"], props["to_node"]
            
            # Theoretical Manning capacity
            base_cap = props.get("base_capacity_m3s")
            if not base_cap:
                base_cap = calculate_manning_capacity(
                    diameter_mm=props["diameter_mm"],
                    slope_m_per_m=props["slope"],
                    roughness_n=props["roughness_n"]
                )
                
            edge_info = {
                "id": edge_id,
                "from_node": u,
                "to_node": v,
                "length_m": props["length_m"],
                "diameter_mm": props["diameter_mm"],
                "roughness_n": props["roughness_n"],
                "slope": props["slope"],
                "base_capacity_m3s": base_cap,
                "coordinates": geom["coordinates"]
            }
            self.edges_data[edge_id] = edge_info
            self.graph.add_edge(u, v, **edge_info)

    def solve_hydraulic_flow(
        self,
        inlet_inflows_m3s: Dict[str, float],
        blockage_pct: float = 0.0,
        conduit_capacity_mult: float = 1.0,
        tide_level_m: float = 2.4
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """
        Solves hydraulic conveyance and surcharge across all nodes and edges.
        Returns:
          - node_results: {node_id: {inflow, outflow, surcharge_m3s, is_surcharged, water_elev_m}}
          - edge_results: {edge_id: {flow_m3s, capacity_m3s, utilization_pct, velocity_ms, status}}
        """
        node_results = {}
        edge_results = {}
        
        # Effective edge capacities
        effective_edge_caps = {}
        for edge_id, e in self.edges_data.items():
            u, v = e["from_node"], e["to_node"]
            is_outfall = self.nodes_data[v]["type"] == "outfall"
            eff_cap = apply_blockage_and_tide(
                base_capacity_m3s=e["base_capacity_m3s"] * conduit_capacity_mult,
                blockage_pct=blockage_pct,
                invert_elev_m=self.nodes_data[v]["invert_elev_m"],
                tide_level_m=tide_level_m,
                is_outfall=is_outfall
            )
            effective_edge_caps[edge_id] = eff_cap

        # Topological sorting or level order traversal
        try:
            topo_order = list(nx.topological_sort(self.graph))
        except nx.NetworkXUnfeasible:
            # Fallback if cycles exist
            topo_order = list(self.graph.nodes())

        # Track cumulative inflows at each node
        node_cum_inflows = {n: 0.0 for n in self.graph.nodes()}
        for node_id, direct_inflow in inlet_inflows_m3s.items():
            if node_id in node_cum_inflows:
                node_cum_inflows[node_id] += direct_inflow

        for node_id in topo_order:
            inflow = node_cum_inflows[node_id]
            out_edges = list(self.graph.out_edges(node_id, data=True))
            
            if not out_edges:
                # Outfall node
                node_results[node_id] = {
                    "node_id": node_id,
                    "inflow_m3s": round(inflow, 3),
                    "outflow_m3s": round(inflow, 3),
                    "surcharge_m3s": 0.0,
                    "is_surcharged": False,
                    "type": self.nodes_data[node_id]["type"]
                }
                continue

            total_downstream_capacity = sum(effective_edge_caps[e[2]["id"]] for e in out_edges)
            
            # Check for surcharge
            if inflow > total_downstream_capacity and total_downstream_capacity > 0:
                surcharge = inflow - total_downstream_capacity
                conveyed_flow = total_downstream_capacity
                is_surcharged = True
            else:
                surcharge = 0.0
                conveyed_flow = inflow
                is_surcharged = False

            node_results[node_id] = {
                "node_id": node_id,
                "inflow_m3s": round(inflow, 3),
                "outflow_m3s": round(conveyed_flow, 3),
                "surcharge_m3s": round(surcharge, 3),
                "is_surcharged": is_surcharged,
                "type": self.nodes_data[node_id]["type"]
            }

            # Distribute conveyed flow into downstream edges proportionally
            for u, v, data in out_edges:
                edge_id = data["id"]
                cap = effective_edge_caps[edge_id]
                ratio = cap / max(total_downstream_capacity, 0.001)
                edge_flow = conveyed_flow * ratio
                node_cum_inflows[v] += edge_flow
                
                util_pct = (edge_flow / max(cap, 0.001)) * 100.0
                vel_ms = calculate_conduit_velocity(edge_flow, data["diameter_mm"])
                
                status = "NORMAL"
                if util_pct >= 100.0 or is_surcharged:
                    status = "SURCHARGE"
                elif util_pct >= 80.0:
                    status = "WARNING"

                edge_results[edge_id] = {
                    "edge_id": edge_id,
                    "from_node": u,
                    "to_node": v,
                    "flow_m3s": round(edge_flow, 3),
                    "capacity_m3s": round(cap, 3),
                    "utilization_pct": round(min(150.0, util_pct), 1),
                    "velocity_ms": vel_ms,
                    "status": status
                }

        return node_results, edge_results
