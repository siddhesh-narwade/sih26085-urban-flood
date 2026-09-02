"""
Module: routing.py
Purpose: Flood-Aware Emergency Routing Engine using dynamic graph weighting.
Calculates safe, flood-resilient routes for Ambulances, Fire Trucks, Police, and Public Transit.
"""

import math
import networkx as nx
from typing import Dict, Any, List, Optional, Tuple
from app.config import settings
from app.models.schemas import RouteRequest, RoutePlanResponse, RouteSegment

class FloodAwareRouter:
    def __init__(self, roads_geojson: Dict[str, Any]):
        self.roads_geojson = roads_geojson
        self.road_nodes: Dict[str, List[float]] = {}
        self.road_edges: Dict[str, Dict[str, Any]] = {}
        self.base_graph = nx.Graph()
        self._build_road_graph()

    def _build_road_graph(self):
        for f in self.roads_geojson.get("features", []):
            props = f["properties"]
            geom = f["geometry"]
            road_id = props["road_id"]
            u, v = props["from_node"], props["to_node"]
            coords = geom["coordinates"]
            
            # Store vertex coordinates (lon, lat)
            self.road_nodes[u] = coords[0]
            self.road_nodes[v] = coords[-1]
            
            length_m = props["length_m"]
            speed_mps = (props.get("speed_limit_kmh", 45) * 1000.0) / 3600.0
            base_time_sec = length_m / max(speed_mps, 1.0)
            
            edge_data = {
                "road_id": road_id,
                "name": props["name"],
                "from_node": u,
                "to_node": v,
                "length_m": length_m,
                "base_time_sec": base_time_sec,
                "criticality": props.get("criticality", 3),
                "coordinates": coords
            }
            self.road_edges[road_id] = edge_data
            self.base_graph.add_edge(u, v, **edge_data)

    def snap_to_valid_node(self, node_or_coord: Any) -> Tuple[str, List[float]]:
        """
        Snaps any given node_id or lat/lon coordinate to the nearest valid junction node on the road graph.
        Never allows unanchored points outside the OSM road network.
        """
        if isinstance(node_or_coord, str) and node_or_coord in self.road_nodes:
            return node_or_coord, self.road_nodes[node_or_coord]

        target_lon, target_lat = 72.8750, 19.0725
        if isinstance(node_or_coord, (list, tuple)) and len(node_or_coord) == 2:
            target_lon, target_lat = float(node_or_coord[0]), float(node_or_coord[1])
        elif isinstance(node_or_coord, str) and "," in node_or_coord:
            try:
                parts = node_or_coord.split(",")
                target_lat, target_lon = float(parts[0].strip()), float(parts[1].strip())
            except ValueError:
                pass

        best_node = list(self.road_nodes.keys())[0]
        min_dist = float("inf")
        for n_id, (n_lon, n_lat) in self.road_nodes.items():
            dist = math.hypot(n_lon - target_lon, n_lat - target_lat)
            if dist < min_dist:
                min_dist = dist
                best_node = n_id

        return best_node, self.road_nodes[best_node]

    def plan_route(
        self,
        request: RouteRequest,
        simulation_state_at_t: Dict[str, Any]
    ) -> RoutePlanResponse:
        """
        Computes both direct shortest route and flood-avoidance safe route strictly along connected road graph edges.
        """
        veh_type = request.vehicle_type.upper()
        profile = settings.VEHICLE_PROFILES.get(veh_type, settings.VEHICLE_PROFILES["AMBULANCE"])
        clearance_cm = profile["max_water_clearance_cm"]
        penalty_mult = profile["penalty_factor"]

        # Snap start and destination to valid road network graph nodes
        start, start_coords = self.snap_to_valid_node(request.start_node_id)
        dest, dest_coords = self.snap_to_valid_node(request.destination_node_id)

        start_name = start.replace("J_", "").replace("_", " ").title()
        dest_name = dest.replace("J_", "").replace("_", " ").title()

        roads_state = simulation_state_at_t.get("roads", {})

        # Graph 1: Direct Shortest Path Graph (Baseline unweighted by flood, strictly along connected roads)
        direct_graph = nx.Graph()
        # Graph 2: Flood-Resilient Weighted Graph (strictly penalizes water accumulation along connected roads)
        safe_graph = nx.Graph()

        for u, v, data in self.base_graph.edges(data=True):
            r_id = data["road_id"]
            r_sim = roads_state.get(r_id, {})
            water_depth_cm = r_sim.get("water_depth_cm", 0.0)
            risk_lvl = r_sim.get("risk_level", "LOW")

            direct_graph.add_edge(u, v, weight=data["base_time_sec"], **data)

            depth_ratio = water_depth_cm / max(clearance_cm, 1.0)
            if water_depth_cm > clearance_cm:
                weight = data["base_time_sec"] * (500.0 + 100.0 * depth_ratio)
            else:
                risk_penalty = 2.0 if risk_lvl == "CRITICAL" else (1.5 if risk_lvl == "HIGH" else 1.0)
                drag_penalty = 1.0 + (10.0 * (depth_ratio ** 2.2)) * risk_penalty
                weight = data["base_time_sec"] * drag_penalty

            safe_graph.add_edge(u, v, weight=weight, **data)

        # 1. Direct Shortest Path
        direct_segments: List[RouteSegment] = []
        direct_distance = 0.0
        direct_time = 0.0
        direct_max_depth = 0.0
        direct_flooded = False

        try:
            if not nx.has_path(direct_graph, start, dest):
                raise nx.NetworkXNoPath("No connected road graph path exists.")

            direct_path_nodes = nx.shortest_path(direct_graph, source=start, target=dest, weight="weight")
            for i in range(len(direct_path_nodes) - 1):
                u_n, v_n = direct_path_nodes[i], direct_path_nodes[i+1]
                e_data = direct_graph[u_n][v_n]
                r_id = e_data["road_id"]
                r_sim = roads_state.get(r_id, {})
                depth = r_sim.get("water_depth_cm", 0.0)
                risk = r_sim.get("risk_level", "LOW")

                if depth > clearance_cm:
                    direct_flooded = True
                if depth > direct_max_depth:
                    direct_max_depth = depth

                direct_distance += e_data["length_m"]
                direct_time += e_data["base_time_sec"]

                seg_coords = list(e_data["coordinates"])
                if u_n != e_data["from_node"]:
                    seg_coords = list(reversed(seg_coords))

                direct_segments.append(RouteSegment(
                    road_id=r_id,
                    road_name=e_data["name"],
                    from_node=u_n,
                    to_node=v_n,
                    length_m=round(e_data["length_m"], 1),
                    travel_time_sec=round(e_data["base_time_sec"], 1),
                    water_depth_cm=round(depth, 1),
                    risk_level=risk,
                    passable=depth <= clearance_cm,
                    coordinates=seg_coords
                ))
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            direct_segments = []

        # 2. Safe Flood-Avoidance Route
        safe_segments: List[RouteSegment] = []
        safe_distance = 0.0
        safe_time = 0.0
        safe_max_depth = 0.0
        safe_found = False
        justification = ""

        try:
            if not nx.has_path(safe_graph, start, dest):
                raise nx.NetworkXNoPath("No valid road-network route found")

            safe_path_nodes = nx.shortest_path(safe_graph, source=start, target=dest, weight="weight")
            safe_found = True
            for i in range(len(safe_path_nodes) - 1):
                u_n, v_n = safe_path_nodes[i], safe_path_nodes[i+1]
                e_data = safe_graph[u_n][v_n]
                r_id = e_data["road_id"]
                r_sim = roads_state.get(r_id, {})
                depth = r_sim.get("water_depth_cm", 0.0)
                risk = r_sim.get("risk_level", "LOW")

                if depth > safe_max_depth:
                    safe_max_depth = depth

                safe_distance += e_data["length_m"]
                depth_ratio = depth / max(clearance_cm, 1.0)
                drag_penalty = 1.0 + (penalty_mult * (depth_ratio ** 2))
                adj_time = e_data["base_time_sec"] * drag_penalty
                safe_time += adj_time

                seg_coords = list(e_data["coordinates"])
                if u_n != e_data["from_node"]:
                    seg_coords = list(reversed(seg_coords))

                safe_segments.append(RouteSegment(
                    road_id=r_id,
                    road_name=e_data["name"],
                    from_node=u_n,
                    to_node=v_n,
                    length_m=round(e_data["length_m"], 1),
                    travel_time_sec=round(adj_time, 1),
                    water_depth_cm=round(depth, 1),
                    risk_level=risk,
                    passable=depth <= clearance_cm,
                    coordinates=seg_coords
                ))

            if safe_max_depth > clearance_cm:
                safe_found = False
                justification = f"ALERT: High flood accumulation across all viable corridors for {veh_type} (Max depth {safe_max_depth:.1f} cm exceeds {clearance_cm} cm clearance limit)."
            elif direct_flooded:
                justification = (
                    f"REROUTE ACTIVATED: Standard direct corridor crosses submerged roads with water depths "
                    f"reaching {direct_max_depth:.1f} cm (exceeding {veh_type} clearance limit of {clearance_cm} cm). "
                    f"Efficient safe route redirects traffic via elevated/unflooded bypass corridor."
                )
            else:
                justification = f"Direct route is fully passable (max flood accumulation {direct_max_depth:.1f} cm below {clearance_cm} cm threshold)."
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            safe_found = False
            justification = "No valid road-network route found"

        return RoutePlanResponse(
            vehicle_type=veh_type,
            vehicle_clearance_cm=clearance_cm,
            time_minute=request.time_minute,
            start_node_id=start,
            destination_node_id=dest,
            start_name=start_name,
            destination_name=dest_name,
            start_coords=start_coords,
            dest_coords=dest_coords,
            safe_route_found=safe_found,
            safe_route_distance_m=round(safe_distance, 1),
            safe_route_eta_min=round(safe_time / 60.0, 1),
            safe_route_max_depth_cm=round(safe_max_depth, 1),
            safe_route_segments=safe_segments,
            direct_route_distance_m=round(direct_distance, 1),
            direct_route_eta_min=round(direct_time / 60.0, 1),
            direct_route_max_depth_cm=round(direct_max_depth, 1),
            direct_route_is_flooded=direct_flooded,
            direct_route_segments=direct_segments,
            reroute_justification=justification
        )
