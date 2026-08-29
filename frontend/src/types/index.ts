export interface RoadSegmentProperties {
  road_id: string;
  name: string;
  road_type: string;
  lanes: number;
  length_m: number;
  base_elev_m: number;
  slope_pct: number;
  imperviousness: number;
  surface_area_m2: number;
  tributary_area_m2: number;
  drainage_node_id: string;
  criticality: number;
  speed_limit_kmh: number;
  data_classification: string;
}

export interface RoadSimulationState {
  road_id: string;
  name: string;
  water_depth_cm: number;
  rainfall_intensity_mmh: number;
  runoff_m3s: number;
  surcharge_m3s: number;
  drainage_utilization_pct: number;
  risk_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  risk_score: number;
  risk_tag: string;
  is_passable_standard: boolean;
  is_passable_ambulance: boolean;
  is_passable_fire: boolean;
  peak_depth_cm: number;
  time_to_peak_min: number;
}

export interface DrainageNodeStatus {
  node_id: string;
  inflow_m3s: number;
  outflow_m3s: number;
  surcharge_m3s: number;
  is_surcharged: boolean;
  type: string;
}

export interface DrainageEdgeStatus {
  edge_id: string;
  from_node: string;
  to_node: string;
  flow_m3s: number;
  capacity_m3s: number;
  utilization_pct: number;
  velocity_ms: number;
  status: 'NORMAL' | 'WARNING' | 'SURCHARGE';
}

export interface TimelineStep {
  time_minute: number;
  storm_center: [number, number];
  current_rainfall_peak_mmh: number;
  roads: Record<string, RoadSimulationState>;
  drainage_nodes: Record<string, DrainageNodeStatus>;
  drainage_edges: Record<string, DrainageEdgeStatus>;
}

export interface SimulationResult {
  metadata: {
    scenario_id: string;
    scenario_title: string;
    execution_time_ms: number;
    total_timesteps: number;
    horizon_minutes: number;
    time_step_min: number;
    blockage_percentage: number;
    conduit_capacity_multiplier: number;
    tide_level_m: number;
    generated_at: string;
  };
  timeline: TimelineStep[];
  alerts: Array<{
    id: string;
    time_min: number;
    severity: string;
    target_name: string;
    message: string;
  }>;
  peak_summary: {
    max_depth_cm: number;
    most_vulnerable_road: string;
    total_surcharging_nodes: number;
  };
}

export interface ExplainFactor {
  factor_name: string;
  percentage: number;
  description: string;
  severity: string;
}

export interface FloodExplainResponse {
  target_id: string;
  target_name: string;
  target_type: string;
  time_minute: number;
  water_depth_cm: number;
  risk_level: string;
  peak_depth_cm: number;
  time_to_peak_min: number;
  factors: ExplainFactor[];
  drainage_status: {
    drainage_node_id: string;
    utilization_pct: number;
    surcharge_m3s: number;
    base_elev_m: number;
  };
  scientific_summary: string;
}

export interface RouteSegment {
  road_id: string;
  road_name: string;
  from_node: string;
  to_node: string;
  length_m: number;
  travel_time_sec: number;
  water_depth_cm: number;
  risk_level: string;
  passable: boolean;
  coordinates: [number, number][];
}

export interface RoutePlanResponse {
  vehicle_type: string;
  vehicle_clearance_cm: number;
  time_minute: number;
  safe_route_found: boolean;
  safe_route_distance_m: number;
  safe_route_eta_min: number;
  safe_route_max_depth_cm: number;
  safe_route_segments: RouteSegment[];
  direct_route_distance_m: number;
  direct_route_eta_min: number;
  direct_route_max_depth_cm: number;
  direct_route_is_flooded: boolean;
  direct_route_segments: RouteSegment[];
  reroute_justification: string;
}

export interface DataLayerMetadata {
  layer_name: string;
  classification: string;
  source: string;
  spatial_resolution: string;
  temporal_resolution: string;
  license: string;
  notes: string;
}

export interface POIFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: [number, number];
  };
  properties: {
    poi_id: string;
    name: string;
    poi_type: string;
    criticality: string;
    description: string;
  };
}
