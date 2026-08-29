"""
Module: surface_flow.py
Purpose: 2D surface terrain flow and topographic depression routing over DEM grid.
"""

import math
from typing import Dict, Any, List

class SurfaceFlowEngine:
    def __init__(self, dem_payload: Dict[str, Any]):
        self.metadata = dem_payload.get("metadata", {})
        self.grid = dem_payload.get("grid", [])
        self.rows = len(self.grid)
        self.cols = len(self.grid[0]) if self.rows > 0 else 0

    def compute_depression_accumulation(
        self,
        rainfall_intensity_matrix: List[List[float]],
        time_step_sec: float = 600.0
    ) -> List[List[float]]:
        """
        Computes 2D surface water accumulation (m^3) across the DEM grid based on D8 flow.
        """
        cell_size = self.metadata.get("cell_size_m", 100)
        cell_area = cell_size * cell_size  # 10,000 m^2
        
        # Initialize cell runoff volume (m^3)
        cell_water = [[0.0 for _ in range(self.cols)] for _ in range(self.rows)]
        for r in range(self.rows):
            for c in range(self.cols):
                I = rainfall_intensity_matrix[r][c]
                C = self.grid[r][c].get("imperviousness", 0.8)
                # Vol = C * (I/1000) * Area * (dt / 3600)
                vol = C * (I / 1000.0) * cell_area * (time_step_sec / 3600.0)
                cell_water[r][c] = vol

        # Route water along D8 flow paths (topological descent by elevation)
        cells_sorted = []
        for r in range(self.rows):
            for c in range(self.cols):
                cells_sorted.append((self.grid[r][c]["elevation_m"], r, c))
        # Sort from highest to lowest elevation
        cells_sorted.sort(key=lambda x: x[0], reverse=True)

        routed_water = [row[:] for row in cell_water]
        for elev, r, c in cells_sorted:
            flow_target = self.grid[r][c].get("flow_to")
            if flow_target:
                tr, tc = flow_target["row"], flow_target["col"]
                # 65% of surface overland flow drains down the gradient to neighbor
                transfer_vol = routed_water[r][c] * 0.65
                routed_water[tr][tc] += transfer_vol
                routed_water[r][c] -= transfer_vol

        return routed_water
