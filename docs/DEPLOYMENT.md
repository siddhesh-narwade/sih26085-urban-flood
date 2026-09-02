# Municipal Deployment & Scaling Roadmap — SIH 26085

## 1. Production Architecture Roadmap (MoES / NCMRWF / Municipal Deployment)

```
[Doppler Weather Radar (DWR) / IMD Satellite Nowcast Feeds]
                 │ (GeoTIFF / HDF5 Grid)
                 ▼
     [NCMRWF Nowcast Ingestion Worker]
                 │
                 ▼
      [PostgreSQL / PostGIS Spatial DB]
                 │
                 ▼
[High-Performance Parallel Hydraulic Simulation Workers]
   (Cell-by-cell 2D Overland + 1D SWD Sewer Pipe Solvers)
                 │
                 ▼
[Disaster Management Authority (DMA) Emergency Dispatch Hub]
   (Live Command Center Dashboard + API Push to Police & EMS)
```

---

## 2. Municipal Data Integration Strategy
To scale this prototype to a full metropolis (e.g. Greater Mumbai, Chennai, or Delhi):
1. **Underground Drainage GIS**: Replace `SIMULATED_DATA` conduits with MCGM Storm Water Drains (SWD) GIS shapefiles containing exact pipe diameters, inverts, and culvert structures.
2. **IoT Water-Level & Manhole Telemetry**: Ingest real-time ultrasonic water-level sensors inside manholes to calibrate pipe friction and dynamic silt accumulation.
3. **IMD Doppler Radar Nowcasts**: Ingest 10-minute IMD Colaba/Veravali Radar reflectivity grids to drive live spatial precipitation fields without human intervention.
4. **Traffic Navigation Integration**: Expose `POST /api/route/plan` to state police 112 dispatch systems and municipal transit control centers.

### MOSDAC configuration
The prototype reads `MOSDAC_USERNAME`, `MOSDAC_PASSWORD`, and optionally
`MOSDAC_DATASET_ID` from the process environment. The default dataset is
`3RIMG_L2B_HEM`. The sync process writes downloaded HDF5 files to
`data/mosdac_raw/` and the processed observation to
`data/processed/mosdac_live_rainfall.json`; both paths are Git-ignored.

For production, use a secret manager, scheduled ingestion worker, object storage,
retry/backoff, audit logging, and a database rather than relying on a dashboard
button for operational refreshes.

---

## 3. Docker Deployment Setup

### Build & Run via Docker Compose:
```bash
cd docker
docker-compose up --build -d
```
- **Backend API**: `http://localhost:8000`
- **Frontend Dashboard**: `http://localhost:80`

For local development, use `http://localhost:5173` for the Vite dashboard and
`http://127.0.0.1:8000/docs` for Swagger API inspection.
