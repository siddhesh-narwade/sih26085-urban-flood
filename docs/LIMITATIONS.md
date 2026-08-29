# Limitations & Honest Technical Disclosures — SIH 26085

In accordance with scientific rigor and SIH guidelines, the known engineering boundaries and operational limitations of this prototype are disclosed below:

---

## 1. Data Limitations
1. **Restricted Underground Drainage GIS**: Complete, georeferenced municipal stormwater drawings and exact underground pipe invert levels are classified by municipal authorities. The prototype utilizes physically calibrated synthetic drainage conduits based on CPHEEO engineering codes.
2. **Coarse Public DEM Resolution**: Public satellite DEMs (Copernicus 30m / SRTM) lack micro-elevation street features (such as 15cm curbs and building plinths). We used synthetic urban micro-topography interpolation to represent road depressions.

---

## 2. Hydrodynamic Solver Simplifications
1. **1D-2D Coupled Approximation**: The solver utilizes 1D Manning pipe routing coupled with 2D cell mass-balance accumulation rather than a full 2D Saint-Venant shallow-water CFD equation solver. This enables sub-50ms execution speed suitable for interactive disaster decision-support, while sacrificing small-scale eddy turbulence modeling.
2. **Constant Runoff Coefficient**: The Rational runoff coefficient $C$ is treated as piecewise constant rather than dynamically varying with antecedent soil moisture saturation curves (e.g. Green-Ampt infiltration).

---

## 3. Operational Prerequisites for Field Deployment
- Direct API integration with IMD Doppler Weather Radar (DWR) NetCDF feeds.
- Integration with municipal tidal gauge stations at Mahim Creek / Mithi River mouth.
- High-resolution Airborne LiDAR ($< 0.5\text{m}$ vertical accuracy) for millimeter-precise curb-level pooling.
