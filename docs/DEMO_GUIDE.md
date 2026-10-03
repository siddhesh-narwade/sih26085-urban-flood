# 5-Minute Demonstration Script — "Urban Cloudburst Emergency Scenario"

This step-by-step walkthrough guides presenters through the winning 5-minute SIH demonstration.

---

## ⏱️ Minute 0:00 – 1:00 | Introduction & Problem Context
1. Open the application at `http://localhost:5173`.
2. Point out the header: **Urban Flood Nowcasting System (SIH 26085)** for **MoES / NCMRWF**.
3. State the core differentiator:
   > *"Most flood dashboards treat AI as an opaque statistical black box that ignores civil infrastructure. Our system explicitly couples atmospheric rainfall nowcasting, high-resolution DEM terrain gradients, and underground directed stormwater pipe hydraulics (Manning's equation) to forecast street-level flood depth in centimeters and dispatch emergency services on safe routes."*

### Optional live MOSDAC proof point
Use this short evidence sequence before the scripted stress test:
1. Open the app at `http://localhost:5173` and click **Data Provenance**.
2. Open **What-If Simulator**, click **Fetch Live MOSDAC Radar**, and wait for the live scenario simulation to finish.
3. Return to **Data Provenance** and click the refresh icon in **MOSDAC DWR Evidence**.
4. Point to the evidence fields: `Acquisition`, HDF5 `Granule`, `Parsed At`, `Rainfall`, dataset ID, and `VALID_OBSERVATIONAL_DATA`.
5. For a second, independently verifiable view, open `http://127.0.0.1:8000/docs` and run `GET /api/data/mosdac/status`. The browser response is the same backend payload used by the UI.

Suggested narration:
> "This is not a hard-coded rainfall label. The frontend calls the FastAPI sync endpoint, the backend authenticates against the MOSDAC catalog, downloads the HDF5 granule, parses the HEM precipitation field, extracts the Kurla-BKC bounding box, persists the result, and then runs the drainage simulation from that parsed field. The evidence card exposes the exact file, timestamp, dataset, and parser status."

The `Acquisition` value is deliberately explicit: `LIVE_MOSDAC_CATALOG` means the latest catalog/download path was used; `LOCAL_MOSDAC_CACHE` means the same parsed HDF5 pipeline used a bundled cached granule because the public service was unavailable. Do not call the latter live during judging. Explain that the observational granule is the real input, while the controlled cloudburst scenario is used for a repeatable demonstration of flooding, surcharge, and routing decisions.

---

## ⏱️ Minute 1:00 – 2:30 | 0–3 Hour Timeline & Surcharge Backflow
1. Click the **Play Button** on the bottom timeline bar.
2. Watch the storm cell track from Northeast to Southwest across the Kurla-BKC corridor.
3. Scrub to **T + 40 min** (Peak Cloudburst: $120\text{ mm/hr}$).
4. Point to the GIS map:
   - Notice **LBS Marg** and **Kurla Station Road** turning bright red/purple ($44\text{ cm}$ flood depth).
   - Point out the **pulsing pink/magenta circles** at manhole `IN_KURLA_01` — show that the underground pipe capacity is exceeded, causing **hydraulic surcharge backflow** onto the street surface.

---

## ⏱️ Minute 2:30 – 3:30 | Explainable AI ("Why is this area flooding?")
1. Click on the submerged **LBS Marg** road segment.
2. The **Explainable AI & Diagnostics Modal** appears.
3. Show the judge the exact causal percentage breakdown:
   - **34% Convective Rainfall Intensity** ($120\text{ mm/hr}$)
   - **28% Topographic Low-Point Depression** ($2.8\text{m}$ base elevation)
   - **22% Drainage Surcharge & Backflow** ($1.8\text{ m}^3/\text{s}$ backflow)
   - **16% Urban Concrete Imperviousness** ($90\%$ paved)
4. Highlight the plain-language scientific decision-support summary.

---

## ⏱️ Minute 3:30 – 4:15 | Flood-Aware Emergency Routing
1. Switch to the **Emergency Routing** tab on the top bar.
2. Select vehicle: **Ambulance** (Clearance: $20\text{ cm}$).
3. Origin: **Kurla Station** $\to$ Destination: **Sion Municipal Hospital**.
4. Click **Calculate Flood-Safe Route**.
5. Show the comparison:
   - **Direct Shortest Route**: Submerged under $44.8\text{ cm}$ of water on LBS Marg (impassable for standard ambulance).
   - **Recommended Safe Route**: Automatically redirects via elevated Nehru Nagar / Tilak Nagar flyover corridors ($4.5\text{ cm}$ max depth, safe ETA $4.8\text{ min}$).

---

## ⏱️ Minute 4:15 – 5:00 | "What-If" Disaster Studio & Conclusion
1. Click the **What-If Simulator** button on the top right.
2. Drag the **Network Silt / Debris Blockage** slider from $25\% \to 60\%$.
3. Click **Execute What-If Nowcast**.
4. Show that within **$< 40\text{ ms}$**, the entire digital twin re-simulates, showing deeper inundation and earlier flood onset.
5. Conclude with the **Data Provenance** tab, showing transparent tiering (`REAL_PUBLIC_DATA`, `DERIVED_DATA`, `SIMULATED_DATA`) and operational municipal scalability.
