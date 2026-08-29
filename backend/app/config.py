import os
from pydantic import BaseModel

class SystemSettings:
    PROJECT_NAME: str = "SIH 26085 - Urban Flood Nowcasting System"
    ORGANIZATION: str = "Ministry of Earth Sciences (MoES) / NCMRWF"
    VERSION: str = "1.0.0-PROTOTYPE"
    
    # Environment
    DEMO_MODE: bool = os.getenv("DEMO_MODE", "true").lower() == "true"
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # File Paths
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    DATA_DIR = os.path.join(BASE_DIR, "data", "processed")
    ROADS_PATH = os.path.join(DATA_DIR, "study_area_roads.geojson")
    DRAINAGE_NODES_PATH = os.path.join(DATA_DIR, "drainage_nodes.geojson")
    DRAINAGE_EDGES_PATH = os.path.join(DATA_DIR, "drainage_edges.geojson")
    DEM_PATH = os.path.join(DATA_DIR, "dem_kurla_grid.json")
    POIS_PATH = os.path.join(DATA_DIR, "critical_infrastructure.geojson")
    SCENARIOS_PATH = os.path.join(DATA_DIR, "nowcast_scenarios.json")

    # Simulation Default Parameters
    DEFAULT_TIME_STEP_MIN: int = 10
    DEFAULT_HORIZON_MIN: int = 180  # 3 Hours
    MANNING_DEFAULT_ROUGHNESS: float = 0.013
    
    # Vehicle Clearance Thresholds (cm)
    VEHICLE_PROFILES = {
        "AMBULANCE": {
            "name": "Emergency Ambulance",
            "max_water_clearance_cm": 20.0,
            "speed_kmh": 60.0,
            "penalty_factor": 4.0,
            "priority": "CRITICAL"
        },
        "FIRE_SERVICE": {
            "name": "Fire & Rescue Heavy Vehicle",
            "max_water_clearance_cm": 45.0,
            "speed_kmh": 50.0,
            "penalty_factor": 2.5,
            "priority": "CRITICAL"
        },
        "POLICE": {
            "name": "Police Rapid Patrol",
            "max_water_clearance_cm": 25.0,
            "speed_kmh": 55.0,
            "penalty_factor": 3.0,
            "priority": "HIGH"
        },
        "PUBLIC_TRANSIT": {
            "name": "BEST Public Bus",
            "max_water_clearance_cm": 35.0,
            "speed_kmh": 35.0,
            "penalty_factor": 2.0,
            "priority": "MEDIUM"
        },
        "COMMUTER": {
            "name": "Private Car / 2-Wheeler",
            "max_water_clearance_cm": 15.0,
            "speed_kmh": 40.0,
            "penalty_factor": 5.0,
            "priority": "STANDARD"
        }
    }

    # Flood Depth Classification Levels (cm)
    DEPTH_LEVELS = [
        {"max": 5.0, "level": "LOW", "color": "#10b981", "label": "Passable (0-5 cm)"},
        {"max": 15.0, "level": "MODERATE", "color": "#f59e0b", "label": "Caution (5-15 cm)"},
        {"max": 30.0, "level": "HIGH", "color": "#f97316", "label": "Hazardous (15-30 cm)"},
        {"max": 50.0, "level": "SEVERE", "color": "#ef4444", "label": "Severe (30-50 cm)"},
        {"max": 999.0, "level": "CRITICAL", "color": "#7f1d1d", "label": "Submerged (>50 cm)"}
    ]

settings = SystemSettings()
