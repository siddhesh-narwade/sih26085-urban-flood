# ISRO MOSDAC Integration Guide

## Why Does the Prototype "Look" the Same?

If you are looking at the map, the rain animation (the blue overlay) and the flooded roads might look visually similar to before. **This is intentional.**

The visual frontend (the map, the colors, the charts) is just the **display layer**. What has fundamentally changed is the **Data Engine** underneath. 

### Before (Simulated Data)
- **How it worked:** We used a random number generator to pretend it was raining. 
- **The Numbers:** The code would say, *"Let's pretend 50mm of rain is falling uniformly across all of Mumbai."*
- **The Problem:** It was purely a math exercise, completely disconnected from real-world weather.

### Now (Real ISRO DWR Data)
- **How it works:** The application connects live to the **ISRO MOSDAC** servers using credentials supplied through environment variables.
- **The Numbers:** It downloads actual satellite and Doppler Weather Radar (DWR) files (HDF5 format). It looks at the exact Latitude and Longitude for the Mumbai Kurla/BKC corridor and extracts the **real millimeter-per-hour (mm/hr)** rainfall currently happening (or recorded).
- **The Result:** The flood depths you see on the roads are now calculated using **real precipitation physics** mapped to real satellite readings.

---

## The Technical Pipeline (What actually happens in the background)

When you select a **MOSDAC** scenario or click **Sync Live MOSDAC Data**, the backend does the following:

1. **Authentication:** Connects to `https://mosdac.gov.in/download_api/gettoken` and logs in.
2. **Catalog Search:** Queries the ISRO dataset catalog for `3RIMG_L2B_HEM` (INSAT-3DR Hydro-Estimator / Precipitation product).
3. **Data Download:** Downloads the actual `.h5` (HDF5) scientific data file for the current timestamp into the `data/mosdac_raw/` folder.
4. **Spatial Extraction:** Uses the `h5py` Python library to open the satellite data, find the exact pixels covering Mumbai (Lat: 18.95-19.20, Lon: 72.75-73.05), and extracts the `HEM` (Hydro-Estimator Rainfall in mm/hr).
5. **Flood Physics Engine:** Feeds this real rain intensity into our Hydraulic routing engine to calculate exactly which roads in the Kurla-BKC area will flood and by how much.

---

## How to Demonstrate this to Judges (Smart India Hackathon)

To prove to the judges that this is real data and not simulated, show them these 3 things:

### 1. The Live Sync Button
On the right-hand panel (What-If Simulator), show them the **"ISRO MOSDAC Radar - Live Sync"** card. Click the **Sync Live Data** button. They will see it fetch the latest dataset.

### 2. The Data Provenance Tab
Click on the **Data Provenance** tab on the left. Show them that the top layer is explicitly listed as:
* **Classification:** `REAL_PUBLIC_DATA`
* **Source:** `ISRO / SAC Meteorological & Oceanographic Satellite Data Archival Centre (MOSDAC)`

### 3. The Backend Terminal (The Hard Proof)
Open your terminal/command prompt where the FastAPI backend is running. When a simulation runs, show the judges the logs. They will physically see the application:
* Getting the MOSDAC token.
* Downloading files like `3RIMG_02SEP2026_1145_L2B_HEM_V01R00.h5`.
* Extracting the spatial matrix for Mumbai.
