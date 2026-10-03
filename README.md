# SIH 26085 — Urban Flood Nowcasting System (Drainage and Rainfall Coupling)

An autonomous, physics-grounded, drainage-aware urban flood digital twin and 0–3 hour nowcasting decision-support system built for the **Ministry of Earth Sciences (MoES)** and **National Centre for Medium Range Weather Forecasting (NCMRWF)** under Smart India Hackathon (Problem Statement **SIH 26085**).

---

## 🌟 Key Highlights & Core Differentiators

Unlike generic statistical or opaque AI dashboards, this system explicitly couples **atmospheric rainfall nowcasting**, **2D topographic surface routing (DEM)**, **underground stormwater pipe hydraulics (Manning's equation)**, **manhole surcharge & backflow**, and **multi-profile emergency routing (Ambulance, Fire, Police, Transit)**.

```
+---------------------------------------------------------------------------------------------------+
|                                      SIH 26085 SYSTEM PIPELINE                                     |
+---------------------------------------------------------------------------------------------------+
|  [RAINFALL NOWCAST (0-3 HR)]    [TERRAIN DEM / LAND COVER]     [DRAINAGE NETWORK GRAPH (MUNICIPAL)]|
|   - Spatial Grid Matrix (mm/hr)   - Elevation Gradients (Z)      - Nodes: Inlets, Manholes, Outfalls|
|   - Temporal Cloudburst Curves    - Slope (S), Aspect, D8 Flow   - Edges: RCC Conduits, Channels    |
|   - MOSDAC HEM + Simulated Scenarios - Imperviousness Index (C) - Manning Roughness (n), Diameter D|
+-----------------------------------+------------------------------+----------------------------------+
                                    |                              |
                                    v                              v
                    +-------------------------------+   +-----------------------------+
                    |   HYDROLOGIC RUNOFF ENGINE    |   |   HYDRAULIC GRAPH ENGINE    |
                    | - Modified Rational / SCS-CN  |   | - Full-pipe & Gravity Flow  |
                    | - Spatial Infiltration losses |   | - Manning's Eq Capacity Q_c |
                    | - Runoff Rate Q_surf (m3/s)   |   | - Blockage Factor beta      |
                    +---------------+---------------+   +--------------+--------------+
                                    |                                  |
                                    +----------------+-----------------+
                                                     |
                                                     v
                                    +---------------------------------+
                                    |    2D DRAINAGE-COUPLED SOLVER   |
                                    | - Inlet Inflow vs Interception  |
                                    | - Overcapacity Pipe Surcharge   |
                                    | - Low-Lying Depression Ponding  |
                                    | - Dynamic Water Depth d_i(t) cm |
                                    +----------------+----------------+
                                                     |
                    +--------------------------------+--------------------------------+
                    |                                |                                |
                    v                                v                                v
     +------------------------------+ +------------------------------+ +------------------------------+
     |     FLOOD RISK & AI XAI      | |   FLOOD-AWARE SAFE ROUTING   | |  COMMAND CENTER GIS UI (WEB) |
     | - Risk Scores (Low-Critical) | | - Dynamic Graph Weighting    | | - 0-3hr Interactive Timeline |
     | - "Why Flooding?" Factor XAI | | - Clearance: Amb/Fire/Car    | | - What-If Disaster Simulator |
     | - Alert Broadcast Engine     | | - Avoids Submerged Segments  | | - Digital Twin Pipe Flows    |
     +------------------------------+ +------------------------------+ +------------------------------+
```

---

## 🚀 Quick Start & How to Run Locally

### Prerequisites
- **Python**: 3.10+
- **Node.js**: 18+ & **npm** 9+

### 1. Launch Backend (FastAPI)
```bash
cd backend
python -m pip install -r requirements.txt
python run.py
```
*API server runs at:* `http://127.0.0.1:8000`  
*Swagger Documentation:* `http://127.0.0.1:8000/docs`

For the complete local startup with live MOSDAC credentials, run
`start_system.bat` from the repository root. It securely prompts for the
MOSDAC username and password, then starts both backend and frontend processes.
The password is held only in the child process environment and is not saved.

### 2. Launch Frontend (React + Vite + Leaflet)
```bash
cd frontend
npm install
npm run dev
```
*UI Command Center runs at:* `http://localhost:5173`

### Free Satellite / Aerial Basemap

The Leaflet map keeps OpenStreetMap as the street basemap and provides a selectable
`Satellite / Aerial View` using Esri World Imagery tiles:

```text
https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}
```

No API key is required for this student prototype. Attribution is displayed on the
map as required by the provider. The requested OpenAerialMap mosaic endpoint was
checked for the BKC area and returned `204 No Content` for a representative zoom-14
tile; its catalog query did not return a usable BKC item, so it is not used as the
primary source. If Esri imagery fails, the map automatically returns to OpenStreetMap;
flood, rainfall, drainage, POI, and route overlays remain separate. Esri imagery is
background imagery, not live video or real-time flood detection, and public tile usage
remains subject to Esri service terms and reasonable-rate limits.

### MOSDAC DWR live data
The backend can ingest the latest ISRO MOSDAC INSAT-3DR Hydro-Estimator
(`3RIMG_L2B_HEM`) HDF5 granule, extract Mumbai pixels, cache the processed field,
and feed those rainfall values into the live simulation scenario. Set credentials
directly in PowerShell before starting the backend:
```powershell
$env:MOSDAC_USERNAME = "your-mosdac-username"
$env:MOSDAC_PASSWORD = "your-mosdac-password"
python backend/run.py
```
The UI button **Fetch Live MOSDAC Radar** syncs the latest granule and immediately
runs `mosdac_live_satellite_dwr`. The API equivalents are `GET /api/data/mosdac/granules`,
`POST /api/data/mosdac/sync`, and `GET /api/data/mosdac/status`.
Downloaded granules and processed observations are local-only and ignored by Git.

### 3. Run Automated Tests & Scientific Sanity Suite
```bash
pytest tests/ -v
```

---

## 🗺️ Demonstration Study Area: Mumbai Kurla-BKC Basin

- **Bounding Box**: Lat `19.0600°N - 19.0850°N`, Lon `72.8600°E - 72.8900°E`
- **Location**: Kurla West, Bandra-Kurla Complex (BKC), Sion, and Mithi River discharge outfalls.
- **Vulnerability**: One of Mumbai's most severe historical flooding zones during monsoon cloudburst events (LBS Marg, Kurla Station, CST Road).

---

## 📊 Scientific Data Provenance

In strict compliance with scientific honesty guidelines:

| Layer | Type | Classification | Source |
| :--- | :--- | :--- | :--- |
| **Roads & Junctions** | Vector GeoJSON | `REAL_PUBLIC_DATA` | OpenStreetMap (OSM) Road Network |
| **Critical POIs** | Vector GeoJSON | `REAL_PUBLIC_DATA` | Sion Hospital, Asian Heart, Fire Stations |
| **DEM Elevation** | 100m Matrix (25x25) | `DERIVED_DATA` | Copernicus GLO-30 / SRTM with micro-topography |
| **Drainage Network** | Directed Graph | `SIMULATED_DATA` | Calibrated municipal prototype network |
| **Rainfall Nowcasts** | HEM spatial field + scenarios | `REAL_API_DATA` / `SIMULATED_DATA` | ISRO MOSDAC HEM + controlled cloudburst profiles |

---

## ⚡ 10 Mandatory Scientific Sanity Tests

All 10 physical axioms are validated and pass 100% in automated CI (`tests/test_scientific_sanity.py`):
1. **Zero Rainfall**: $I=0 \implies \text{Depth}=0$, no surcharge.
2. **Light Rainfall + Clean Drains**: Shallow runoff, low utilization ($<35\%$).
3. **Heavy Rain + High Capacity**: Minimal surface ponding.
4. **Heavy Rain + Constricted Conduits**: Surcharge backflow detected.
5. **Blockage Sensitivity**: $60\%$ blockage strictly increases flood volume vs clean conduits.
6. **Topographic Depression Preference**: Low-elevation roads pool deeper water.
7. **Capacity Scaling**: $2\times$ capacity strictly reduces peak depth vs $0.5\times$.
8. **Emergency Routing Avoidance**: Router reroutes around submerged links exceeding vehicle clearance.
9. **Monotonic Rainfall Scaling**: Scaling $30 \to 75 \to 120\text{mm/h}$ monotonically increases inundation.
10. **Progressive Blockage Degradation**: Monotonic capacity deterioration ($0\% \to 80\%$).

---

## 📂 Documentation Links
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — Comprehensive technical design
- [DATA_SOURCES.md](docs/DATA_SOURCES.md) — Data provenance & metadata
- [SCIENTIFIC_ASSUMPTIONS.md](docs/SCIENTIFIC_ASSUMPTIONS.md) — Hydraulic & hydrologic formulas
- [API.md](docs/API.md) — Full REST API specifications
- [VALIDATION.md](docs/VALIDATION.md) — Scenario benchmark validation report
- [DEMO_GUIDE.md](docs/DEMO_GUIDE.md) — 5-minute SIH presentation script
- [DEPLOYMENT.md](docs/DEPLOYMENT.md) — Municipal deployment roadmap
- [LIMITATIONS.md](docs/LIMITATIONS.md) — Transparent limitations & future work
- [FINAL_VERIFICATION.md](FINAL_VERIFICATION.md) — Verification & test execution report
