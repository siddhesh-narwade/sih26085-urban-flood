"""
Module: data_loader.py
Purpose: Safely loads and caches all geospatial layers, DEM matrices, and scenarios.
"""

import json
import os
from typing import Dict, Any
from app.config import settings

class DataLoader:
    def __init__(self):
        self.roads = self._load_json(settings.ROADS_PATH)
        self.drainage_nodes = self._load_json(settings.DRAINAGE_NODES_PATH)
        self.drainage_edges = self._load_json(settings.DRAINAGE_EDGES_PATH)
        self.dem = self._load_json(settings.DEM_PATH)
        self.pois = self._load_json(settings.POIS_PATH)
        self.scenarios = self._load_json(settings.SCENARIOS_PATH)

    def _load_json(self, filepath: str) -> Dict[str, Any]:
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Required dataset not found: {filepath}. Run scripts/generate_demo_dataset.py first.")
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)

# Global singleton
dataset = DataLoader()
