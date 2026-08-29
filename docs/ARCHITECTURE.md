# System Architecture — SIH 26085 Urban Flood Nowcasting

## 1. High-Level Modular Design

The system is partitioned into cleanly decoupled modules following separation of concerns:

```
[FRONTEND UI (React + Vite + Leaflet)]
   │
   ├── REST HTTP Calls (Axios)
   ▼
[FASTAPI REST BACKEND]
   │
   ├── [Hydrology Engine]       --> Modified Rational Runoff & Spatial Rain Matrix
   ├── [Hydraulic Graph Engine] --> Manning full-pipe capacity & Surcharge Solver
   ├── [Surface Flow Engine]    --> 2D Topographic DEM Overland Accumulation
   ├── [Flood Simulation Hub]   --> Mass-conservative 0-3hr timeline coordinator
   ├── [Risk & XAI Engine]      --> Multi-criteria risk scoring & "Why Flooding?" Causal decomposition
   └── [Flood Router]           --> Multi-profile dynamic graph Dijkstra/A* pathfinder
```

---

## 2. Component Directory Architecture

```
sih26085_urban_flood/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── simulation_routes.py  # Simulation execution & XAI endpoints
│   │   │   ├── drainage_routes.py    # Nodes, edges, and real-time status
│   │   │   ├── routing_routes.py     # Multi-vehicle emergency routing
│   │   │   └── data_routes.py        # Provenance, POIs, and system health
│   │   ├── engine/
│   │   │   ├── hydrology.py          # Runoff generation & storm decay
│   │   │   ├── hydraulic.py          # Manning formula & blockage degradation
│   │   │   ├── drainage_graph.py     # NetworkX directed drainage graph
│   │   │   ├── surface_flow.py       # DEM depression overland routing
│   │   │   ├── flood_engine.py       # 0-3hr simulation master coordinator
│   │   │   ├── risk_engine.py        # Multi-factor risk classification
│   │   │   ├── explainability.py     # XAI causal factor decomposition
│   │   │   └── routing.py            # Dynamic clearance-weighted routing
│   │   ├── models/schemas.py         # Pydantic request/response models
│   │   ├── config.py                 # System configurations & thresholds
│   │   ├── data_loader.py            # Data layer loader & validator
│   │   └── main.py                   # FastAPI application entrypoint
│   ├── requirements.txt
│   └── run.py
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.tsx            # Command center top bar
│   │   │   ├── MapView.tsx           # Leaflet interactive GIS canvas
│   │   │   ├── TimelineBar.tsx       # 0-3hr playback scrubber
│   │   │   ├── WhatIfSimulator.tsx   # Interactive disaster simulation studio
│   │   │   ├── ExplainabilityModal.tsx # Causal diagnostic modal
│   │   │   ├── RoutingPanel.tsx      # Emergency safe routing drawer
│   │   │   ├── DrainageTwinView.tsx  # Technical pipe telemetry view
│   │   │   ├── AlertsFeed.tsx        # Incident feed & warnings
│   │   │   └── ProvenanceModal.tsx   # Scientific data registry
│   │   ├── services/api.ts           # Axios backend API client
│   │   ├── types/index.ts            # TypeScript interfaces
│   │   └── App.tsx                   # Master state container
│   ├── package.json
│   └── vite.config.ts
├── data/processed/                   # Geospatial demonstration layers
├── tests/                            # Comprehensive unit & scientific sanity tests
└── docs/                             # Full scientific and operational documentation
```

---

## 3. Computational Complexity & Real-Time Performance
- **Hydraulic Graph Traversals**: $O(|V| + |E|)$ via topological sort, executing in $< 5\text{ ms}$ for urban basins.
- **Surface Mass-Balance Time Stepping**: $O(N_{\text{roads}} \times T_{\text{steps}})$, solving full 18 timesteps in $< 20\text{ ms}$.
- **Safe Dynamic Routing**: $O(|E_{\text{road}}| + |V_{\text{road}}| \log |V_{\text{road}}|)$ using Fibonacci heap Dijkstra, responding in $< 10\text{ ms}$.
- Total end-to-end nowcast execution takes **$< 100\text{ ms}$**, enabling instantaneous What-If scenario experimentation during municipal decision-making.
