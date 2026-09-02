# Scientific Data Sources & Provenance Matrix — SIH 26085

## 1. Classification Methodology

To maintain strict scientific honesty and prevent fabrication of municipal datasets, all geospatial layers are categorized under a four-tier classification system:

- `REAL_PUBLIC_DATA`: Openly available authoritative geometry directly extracted from public repositories.
- `REAL_API_DATA`: Data dynamically queried from live public meteorology/satellite APIs.
- `DERIVED_DATA`: Topographic or land-cover metrics deterministically calculated from real public datasets.
- `SIMULATED_DATA`: Synthesized prototype infrastructure based on standard municipal civil engineering codes where underground utility GIS is classified/restricted.

---

## 2. Comprehensive Layer Provenance

### Layer 1: Road Network & Street Segments
- **Classification**: `REAL_PUBLIC_DATA`
- **Source**: OpenStreetMap (OSM) via Overpass API / Geofabrik Mumbai Sub-Region
- **Spatial Resolution**: Sub-meter vector LineStrings
- **Temporal Resolution**: 2024 OSM update
- **License**: Open Data Commons Open Database License (ODbL)
- **Bounding Box**: Lat `[19.0600, 19.0850]`, Lon `[72.8600, 72.8900]` (Kurla West, BKC, Sion)

### Layer 2: Critical Infrastructure POIs
- **Classification**: `REAL_PUBLIC_DATA`
- **Source**: Municipal Corporation of Greater Mumbai (MCGM) Open GeoPortal & OSM
- **Spatial Resolution**: Point vector coordinates
- **Entities**: Lokmanya Tilak Municipal General Hospital (Sion), Asian Heart Institute (BKC), Kurla West Fire Station, BKC Fire Station, Kurla Railway Hub, BEST Kalina Bus Depot.

### Layer 3: Digital Elevation Model (DEM) & Topography
- **Classification**: `DERIVED_DATA`
- **Source**: Copernicus GLO-30 / SRTM 30m Digital Elevation Model
- **Processing**: Resampled onto a 25x25 spatial grid (100m cell resolution) with urban micro-topography interpolation (incorporating low-elevation road depressions along LBS Marg and Mithi riverbanks).
- **Derived Products**: D8 steepest descent flow directions, local slope percentages, and impervious fraction indices ($C \approx 0.75-0.90$).

### Layer 4: Municipal Stormwater Drainage Network
- **Classification**: `SIMULATED_DATA (Calibrated Prototype Stormwater Network)`
- **Source**: Synthesized based on Central Public Health and Environmental Engineering Organisation (CPHEEO) Stormwater Manual guidelines.
- **Node Entities**: 18 nodes (14 Drop Inlets, 5 Trunk Manholes/Junctions, 3 Tidal Outfalls discharging into Mithi River and Vakola Nallah).
- **Edge Entities**: 19 conduits (RCC pipes with diameters $\varnothing 600\text{mm} - 1800\text{mm}$, Manning roughness $n = 0.012 - 0.014$, design slopes $S \ge 0.15\%$).
- **Notice**: In operational municipal deployment, these prototype parameters are directly replaceable by MCGM SWD (Storm Water Drains) GIS records without modifying any core solver code.

### Layer 5: MOSDAC DWR / Satellite Rainfall
- **Classification**: `REAL_API_DATA`
- **Source**: ISRO / SAC MOSDAC, dataset `3RIMG_L2B_HEM`.
- **Product**: INSAT-3DR Level-2B Hydro-Estimator precipitation in HDF5 format.
- **Processing**: The newest catalog entry is downloaded after authentication; `HEM`, `Latitude`, and `Longitude` are masked to the Mumbai study area and cached locally.
- **Application**: The live scenario selects the nearest extracted rainfall sample for each road segment, so the map, runoff, hydraulics, and timeline use the same observation.
- **Limitation**: A valid granule may report zero rainfall over Mumbai. That is an observation, not a sync failure.

### Layer 6: Controlled 0–3 Hour Stress Scenarios
- **Classification**: `SIMULATED_DATA`
- **Source**: Repeatable cloudburst, heavy monsoon, tidal-lock, and blockage profiles for engineering stress testing and demonstrations.
- **Purpose**: These scenarios remain available so surcharge, inundation, and safe-routing behavior is reproducible when the current live observation is dry.
