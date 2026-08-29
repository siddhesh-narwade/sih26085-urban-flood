from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

# --- Simulation Input Schemas ---
class SimulationRequest(BaseModel):
    scenario_id: Optional[str] = Field(default="cloudburst_emergency_120mm", description="Preconfigured scenario ID")
    rainfall_intensity_multiplier: float = Field(default=1.0, ge=0.0, le=3.0, description="Multiplier for rainfall intensity")
    blockage_percentage: float = Field(default=25.0, ge=0.0, le=90.0, description="Overall drainage blockage percentage (0-90%)")
    conduit_capacity_multiplier: float = Field(default=1.0, ge=0.5, le=2.0, description="Drainage hydraulic capacity scale factor")
    tide_level_m: float = Field(default=2.4, ge=0.5, le=4.5, description="Tidal outfall water level in meters")
    horizon_minutes: int = Field(default=180, ge=30, le=180, description="Prediction horizon in minutes (0-3 hours)")
    time_step_min: int = Field(default=10, ge=5, le=30, description="Time step delta in minutes")

# --- Routing Schemas ---
class RouteRequest(BaseModel):
    start_node_id: str = Field(..., description="Starting road junction ID")
    destination_node_id: str = Field(..., description="Destination road junction ID")
    vehicle_type: str = Field(default="AMBULANCE", description="Vehicle profile: AMBULANCE, FIRE_SERVICE, POLICE, PUBLIC_TRANSIT, COMMUTER")
    time_minute: int = Field(default=40, ge=0, le=180, description="Forecast time step at which routing is evaluated")

class RouteSegment(BaseModel):
    road_id: str
    road_name: str
    from_node: str
    to_node: str
    length_m: float
    travel_time_sec: float
    water_depth_cm: float
    risk_level: str
    passable: bool
    coordinates: List[List[float]]

class RoutePlanResponse(BaseModel):
    vehicle_type: str
    vehicle_clearance_cm: float
    time_minute: int
    
    # Safe Route
    safe_route_found: bool
    safe_route_distance_m: float
    safe_route_eta_min: float
    safe_route_max_depth_cm: float
    safe_route_segments: List[RouteSegment]
    
    # Baseline Shortest Route (comparison)
    direct_route_distance_m: float
    direct_route_eta_min: float
    direct_route_max_depth_cm: float
    direct_route_is_flooded: bool
    direct_route_segments: List[RouteSegment]
    
    reroute_justification: str

# --- Explainability Schemas ---
class ExplainFactor(BaseModel):
    factor_name: str
    percentage: float
    description: str
    severity: str

class FloodExplainResponse(BaseModel):
    target_id: str
    target_name: str
    target_type: str  # road / drainage_node
    time_minute: int
    water_depth_cm: float
    risk_level: str
    peak_depth_cm: float
    time_to_peak_min: int
    factors: List[ExplainFactor]
    drainage_status: Dict[str, Any]
    scientific_summary: str

# --- Data Provenance & Status Schemas ---
class DataLayerMetadata(BaseModel):
    layer_name: str
    classification: str  # REAL_PUBLIC_DATA, DERIVED_DATA, SIMULATED_DATA
    source: str
    spatial_resolution: str
    temporal_resolution: str
    license: str
    notes: str

class SystemHealthResponse(BaseModel):
    status: str
    demo_mode: bool
    project: str
    organization: str
    study_area: str
    active_scenario: str
    nodes_count: int
    edges_count: int
    roads_count: int
