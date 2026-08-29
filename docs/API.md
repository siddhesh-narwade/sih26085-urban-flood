# REST API Documentation — SIH 26085

Base URL: `http://127.0.0.1:8000`  
Interactive Swagger UI: `http://127.0.0.1:8000/docs`

---

## 1. Simulation Endpoints

### `POST /api/simulation/run`
Executes full 0–3 hour nowcast simulation with custom hydrologic and hydraulic parameters.

**Request Body:**
```json
{
  "scenario_id": "cloudburst_emergency_120mm",
  "rainfall_intensity_multiplier": 1.2,
  "blockage_percentage": 30.0,
  "conduit_capacity_multiplier": 1.0,
  "tide_level_m": 2.8,
  "horizon_minutes": 180,
  "time_step_min": 10
}
```

**Response:**
```json
{
  "metadata": {
    "scenario_id": "cloudburst_emergency_120mm",
    "scenario_title": "Severe Cloudburst Deluge (120 mm/hr)",
    "execution_time_ms": 38.5,
    "total_timesteps": 19,
    "horizon_minutes": 180
  },
  "timeline": [
    {
      "time_minute": 0,
      "current_rainfall_peak_mmh": 18.0,
      "roads": {
        "R_LBS_01": {
          "water_depth_cm": 2.1,
          "risk_level": "LOW",
          "surcharge_m3s": 0.0
        }
      },
      "drainage_nodes": {
        "IN_KURLA_01": {
          "inflow_m3s": 0.15,
          "is_surcharged": false
        }
      }
    }
  ],
  "alerts": [],
  "peak_summary": {
    "max_depth_cm": 44.8,
    "most_vulnerable_road": "R_LBS_01",
    "total_surcharging_nodes": 2
  }
}
```

---

### `GET /api/simulation/current`
Returns active simulation timeline results.

---

### `GET /api/simulation/explain/{road_id}?time_min=40`
Returns explainable AI (XAI) causal factor breakdown for why a specific road is flooded at a given forecast timestep.

**Response:**
```json
{
  "target_id": "R_LBS_01",
  "target_name": "LBS Marg (Kurla Stn to Kurla West)",
  "target_type": "road",
  "time_minute": 40,
  "water_depth_cm": 44.8,
  "risk_level": "CRITICAL",
  "peak_depth_cm": 44.8,
  "time_to_peak_min": 40,
  "factors": [
    {
      "factor_name": "Convective Rainfall Intensity",
      "percentage": 34.2,
      "description": "High precipitation rate of 120.0 mm/hr exceeding base infiltration threshold.",
      "severity": "HIGH"
    },
    {
      "factor_name": "Topographic Low-Point Depression",
      "percentage": 28.5,
      "description": "Road base elevation (2.8m) forms a natural catchment basin.",
      "severity": "CRITICAL"
    },
    {
      "factor_name": "Drainage Surcharge & Backflow",
      "percentage": 22.1,
      "description": "Underground trunk drain capacity exceeded by 1.84 m³/s, causing backflow.",
      "severity": "CRITICAL"
    }
  ],
  "scientific_summary": "LBS Marg is experiencing CRITICAL flooding (44.8 cm)..."
}
```

---

## 2. Emergency Routing Endpoints

### `POST /api/route/plan`
Computes comparative direct vs flood-avoidance route for specified vehicle profile.

**Request Body:**
```json
{
  "start_node_id": "J_KURLA_STN",
  "destination_node_id": "J_SION_HOSP",
  "vehicle_type": "AMBULANCE",
  "time_minute": 40
}
```

**Response:**
```json
{
  "vehicle_type": "AMBULANCE",
  "vehicle_clearance_cm": 20.0,
  "time_minute": 40,
  "safe_route_found": true,
  "safe_route_distance_m": 3150.4,
  "safe_route_eta_min": 4.8,
  "safe_route_max_depth_cm": 4.5,
  "direct_route_is_flooded": true,
  "direct_route_max_depth_cm": 44.8,
  "reroute_justification": "REROUTE ACTIVATED: Standard direct corridor crosses submerged roads with water depths reaching 44.8 cm..."
}
```

---

## 3. Data & Health Endpoints
- `GET /api/data/health` — System status, dataset statistics, and demo mode indicator.
- `GET /api/data/provenance` — Metadata registry and tier classification.
- `GET /api/data/roads` — Road network GeoJSON.
- `GET /api/drainage/nodes` — Drainage nodes GeoJSON.
- `GET /api/drainage/edges` — Drainage conduits GeoJSON.
- `GET /api/data/poi` — Critical infrastructure POIs GeoJSON.
- `GET /api/data/dem` — DEM 25x25 elevation grid JSON.
