# SIH 2026 PROJECT TECHNICAL MASTER DOCUMENTATION
## DRAINAGE-COUPLED URBAN FLOOD DIGITAL TWIN & EMERGENCY NOWCASTING SYSTEM
**Problem Statement SIH 26085 | Ministry of Earth Sciences (MoES) / NCMRWF**

---

## 1. EXECUTIVE SUMMARY & PROBLEM STATEMENT

Urban flooding in tropical metropolitan basins like **Mumbai (Kurla West - BKC Corridor)** is caused by intense localized precipitation, high tidal locks along coastal outfalls (Mithi River), and urban drainage pipe surcharge. Traditional flood alerts fail to provide block-by-block street water depth nowcasting or safe emergency routing for rescue vehicles.

Our system builds a **coupled hydrology-drainage-hydraulic digital twin** that predicts street-level flood depth every minute (0–3 hr forecast horizon) and dynamically reroutes emergency vehicles (Ambulance, Fire Truck, Police) along flood-safe real OpenStreetMap (OSM) road networks.

---

## 2. COMPLETE TECHNOLOGY STACK & FRAMEWORKS

### **Backend Frameworks & Runtime**
* **Python 3.14+**: Core language for high-performance scientific modeling, graph routing, and REST API handling.
* **FastAPI 0.115+**: Asynchronous, high-throughput web framework providing RESTful endpoints, automatic OpenAPI validation, and JSON serialization.
* **Uvicorn**: Lightning-fast ASGI server for production deployment.
* **NetworkX 3.4+**: Graph theory library used to model the 1D urban drainage pipe network and directed road network graphs for Dijkstra/A* routing.
* **NumPy & SciPy**: Fast numerical array computing used in hydrologic surface runoff convolution, rainfall intensity distribution, and hydraulic solver routines.
* **Pytest**: Automated test runner executing 32 backend verification tests (`tests/`).

### **Frontend Frameworks & Visualization**
* **React 18.3+**: Declarative component-based UI framework for building real-time command dashboards.
* **TypeScript 5.6+**: Strictly typed JavaScript ensuring type safety across state management and API responses.
* **Vite 6.4+**: Next-generation frontend build tool providing Instant HMR (Hot Module Replacement) and optimized production chunk bundling.
* **Leaflet 1.9+**: High-performance interactive GIS mapping engine for rendering GeoJSON layers, dynamic polyline stitching, storm cores, and emergency vehicle markers.
* **TailwindCSS 3.4+**: Modern utility-first CSS framework with glassmorphism Dark Mode UI (`#0f172a` slate palette).
* **Lucide React**: Clean SVG icon library for GIS command controls and emergency indicators.
* **Axios**: Promise-based HTTP client for fetching simulation timelines and route calculation APIs.

---

## 3. ALL DATASETS & GIS LAYERS

All geospatial data covers the **Kurla West - BKC - Sion Basin, Mumbai (BBox: [72.86, 19.06, 72.89, 19.085])**.

| Dataset File | Format | Features / Scale | Technical Description |
| :--- | :--- | :--- | :--- |
| `study_area_roads.geojson` | GeoJSON | 18 Road Corridors | Contains 850+ real OpenStreetMap (OSRM) street curve coordinates, elevation ($z$), slope, lanes, speed limits, and connected junction nodes (`from_node`, `to_node`). |
| `drainage_pipes.geojson` | GeoJSON | 16 Sewer Main Conductors | Underground stormwater drainage pipes with diameter ($D$), length ($L$), Roughness coefficient ($n=0.013$), slope ($S$), and outfall destination. |
| `drainage_nodes.geojson` | GeoJSON | 17 Catchment Inlets & Outfalls | Manholes, catch basins, and outfall gates with inversion elevation ($z_{\text{inv}}$), rim elevation, and surcharge risk thresholds. |
| `pois.json` | JSON | Critical Emergency Infrastructure | Hospitals, Fire Stations, Police Command Posts, and Evacuation Centers with exact geographic coordinates for vehicle dispatching. |

---

## 4. COMPLETE REST API SPECIFICATION

The backend runs on **`http://127.0.0.1:8000`** with OpenAPI docs available at `/docs`.

### **1. Simulation Routes (`/api/simulation`)**
* **`POST /api/simulation/run`**:
  - *Description*: Executes a 0–180 minute rainfall event simulation using 1-minute time steps.
  - *Payload*: `{"duration_minutes": 180, "peak_intensity_mmh": 85.0}`
  - *Response*: Returns complete timeline containing storm center coordinates, rainfall rate, street water depths ($\text{cm}$), pipe utilization (\%), surcharge flags, and flood risk levels.
* **`GET /api/simulation/latest`**:
  - *Description*: Retrieves cached results of the latest nowcast simulation.

### **2. Emergency Routing Routes (`/api/route`)**
* **`POST /api/route/plan`**:
  - *Description*: Calculates direct baseline route vs flood-avoidance safe route along real OSM roads.
  - *Payload*:
    ```json
    {
      "start_node_id": "J_KURLA_STN",
      "destination_node_id": "J_SION_HOSP",
      "vehicle_type": "AMBULANCE",
      "time_minute": 30
    }
    ```
  - *Response*: Returns snapped `start_coords`, `dest_coords`, safe distance ($m$), ETA ($min$), max water depth ($cm$), reroute justification, and ordered `RouteSegment` lists with real OSM coordinate arrays.
* **`GET /api/route/nodes`**:
  - *Description*: Returns list of available road network junctions for source/destination dropdowns.
* **`GET /api/route/profiles`**:
  - *Description*: Returns vehicle clearance limits (`AMBULANCE`: 20cm, `FIRE_TRUCK`: 40cm, `POLICE`: 25cm, `TRANSIT`: 35cm).

### **3. Drainage Network Routes (`/api/drainage`)**
* **`GET /api/drainage/network`**:
  - *Description*: Returns GeoJSON representation of pipes and manholes with live hydraulic stats.

---

## 5. SCIENTIFIC & MATHEMATICAL MODELING ENGINE

### **A. Hydrology Model (SCS Curve Number & Rational Method)**
Runoff hydrograph volume $Q_{\text{runoff}}$ ($m^3/s$) for each road tributary area $A_{\text{trib}}$ is computed using the Soil Conservation Service (SCS) Curve Number formula:

$$S = \frac{25400}{CN} - 254$$

$$P_{\text{cum}} = \int_0^t I(\tau) d\tau$$

$$Q_{\text{cum}} = \frac{(P_{\text{cum}} - 0.2S)^2}{P_{\text{cum}} + 0.8S} \quad \text{for } P_{\text{cum}} > 0.2S$$

Where $CN \approx 88-92$ for impervious urban Mumbai asphalt surfaces.

### **B. Hydraulic Model (Manning's 1D Sewer Capacity & Submergence)**
Full-pipe gravitational discharge capacity $Q_{\text{full}}$ ($m^3/s$) is solved via Manning's Equation:

$$Q_{\text{full}} = \frac{1}{n} A R_h^{2/3} S^{1/2}$$

Where:
* $n = 0.013$ (Smooth concrete drainage conduit Manning roughness)
* $A = \frac{\pi D^2}{4}$ (Cross-sectional pipe area)
* $R_h = \frac{D}{4}$ (Hydraulic radius for circular pipe running full)
* $S$ = Longitudinal pipe bed slope ($\text{m/m}$)

When inflow $Q_{\text{in}} > Q_{\text{full}}$, pipe utilization exceeds 100\%, triggering manhole surcharge. Excess surface water accumulates on adjacent street segments:

$$\Delta d_{\text{water}} (\text{cm}) = \frac{(Q_{\text{in}} - Q_{\text{full}}) \cdot 60}{A_{\text{street}}} \times 100$$

### **C. Flood-Aware Graph Routing Engine**
The road network is represented as an undirected graph $G = (V, E)$.
* **Base Travel Time**: $T_{\text{base}} = \frac{\text{length\_m}}{v_{\text{speed}}}$
* **Dynamic Hydrodynamic Drag Weighting**:

$$W_{\text{safe}} = T_{\text{base}} \times \left(1.0 + 10.0 \cdot \left(\frac{d_{\text{water}}}{d_{\text{clearance}}}\right)^{2.2} \times K_{\text{risk}}\right)$$

If $d_{\text{water}} > d_{\text{clearance}}$, $W_{\text{safe}} = T_{\text{base}} \times \left(500.0 + 100.0 \cdot \frac{d_{\text{water}}}{d_{\text{clearance}}}\right)$, forcing Dijkstra / A* to route rescue vehicles via elevated, unflooded bypass corridors.

---

## 6. SIH PRESENTATION & JURY Q&A DEFENSE GUIDE

### **Q1: How does your system differ from Google Maps or Waze?**
> *"Google Maps relies on crowd-sourced GPS speeds after traffic has already slowed down. Our system couples 1D drainage hydraulics with rainfall nowcasting to PREDICT street water depth in centimeters BEFORE vehicles get stuck. Furthermore, Google Maps does not know vehicle water clearance limits (e.g. 20cm for ambulances vs 40cm for fire trucks)."*

### **Q2: Does your routing use fake straight lines between junctions?**
> *"No. Our router uses nearest-node snapping to anchor origin/destination pins directly on the OpenStreetMap graph. Segments are fetched from official OSRM geometries containing 850+ real street curve points that trace every road bend on Leaflet."*

### **Q3: What happens if all roads in an area are submerged?**
> *"If water depth exceeds vehicle clearance across all available corridors, the graph router returns `safe_route_found = False` with the alert message: 'No valid road-network route found. Deploy amphibious rescue assets.' This prevents sending emergency crews into submerged death traps."*

### **Q4: Can this system scale to other cities beyond Mumbai?**
> *"Yes! The pipeline is 100% data-driven. By replacing `study_area_roads.geojson` and `drainage_pipes.geojson` with OpenStreetMap and municipal SWD data for Delhi, Chennai, or Bengaluru, the entire physics engine and routing dashboard immediately operate for any city."*
