"""ISRO MOSDAC HEM/DWR catalog client and rainfall field interpolator."""

import glob
import json
import logging
import math
import os
import time
from typing import Any, Dict, List, Optional

import numpy as np
import requests
from app.config import settings

try:
    import h5py
except ImportError:
    h5py = None

logger = logging.getLogger("mosdac_service")
STUDY_BBOX = {"min_lat": 18.95, "max_lat": 19.20, "min_lon": 72.75, "max_lon": 73.05}


class MOSDACService:
    def __init__(self) -> None:
        self.username = settings.MOSDAC_USERNAME
        self.password = settings.MOSDAC_PASSWORD
        self.raw_dir = settings.MOSDAC_RAW_DIR
        self.processed_path = settings.MOSDAC_PROCESSED_PATH
        os.makedirs(self.raw_dir, exist_ok=True)
        os.makedirs(os.path.dirname(self.processed_path), exist_ok=True)
        self.access_token: Optional[str] = None
        self.token_expiry = 0.0
        self.latest_rainfall_field: Optional[Dict[str, Any]] = None
        self._load_cached_processed_data()

    def _load_cached_processed_data(self) -> None:
        if os.path.exists(self.processed_path):
            try:
                with open(self.processed_path, "r", encoding="utf-8") as data_file:
                    self.latest_rainfall_field = json.load(data_file)
            except (OSError, json.JSONDecodeError) as exc:
                logger.warning("Unable to read MOSDAC cache: %s", exc)

    def authenticate(self) -> bool:
        if not self.username or not self.password:
            return False
        if self.access_token and time.time() < self.token_expiry:
            return True
        try:
            response = requests.post(settings.MOSDAC_TOKEN_URL, json={"username": self.username, "password": self.password}, timeout=10)
            response.raise_for_status()
            self.access_token = response.json().get("access_token")
            self.token_expiry = time.time() + 480
            return bool(self.access_token)
        except (requests.RequestException, ValueError) as exc:
            logger.warning("MOSDAC authentication failed: %s", exc)
            return False

    def search_latest_granules(self, dataset_id: Optional[str] = None, count: int = 5) -> List[Dict[str, Any]]:
        try:
            response = requests.get(settings.MOSDAC_SEARCH_URL, params={"datasetId": dataset_id or settings.MOSDAC_DATASET_ID, "count": count}, timeout=10)
            response.raise_for_status()
            entries = response.json().get("entries", [])
            return entries or self._local_granule_entries(count)
        except (requests.RequestException, ValueError) as exc:
            logger.warning("MOSDAC catalog search failed: %s", exc)
            return self._local_granule_entries(count)

    def _local_granule_entries(self, count: int) -> List[Dict[str, Any]]:
        local_files = sorted(
            glob.glob(os.path.join(self.raw_dir, "*.h5")),
            key=os.path.getmtime,
            reverse=True,
        )
        return [
            {
                "id": index,
                "identifier": os.path.basename(file_path),
                "source": "LOCAL_MOSDAC_CACHE",
            }
            for index, file_path in enumerate(local_files[:count], start=1)
        ]

    def download_granule(self, record_id: int, identifier: str) -> Optional[str]:
        if not self.authenticate():
            return None
        output_path = os.path.join(self.raw_dir, identifier)
        if os.path.exists(output_path) and os.path.getsize(output_path) > 100000:
            return output_path
        partial_path = f"{output_path}.part"
        try:
            response = requests.get(settings.MOSDAC_DOWNLOAD_URL, headers={"Authorization": f"Bearer {self.access_token}"}, params={"id": record_id}, stream=True, timeout=30)
            response.raise_for_status()
            with open(partial_path, "wb") as output_file:
                for chunk in response.iter_content(chunk_size=1024 * 1024):
                    if chunk:
                        output_file.write(chunk)
            os.replace(partial_path, output_path)
            return output_path
        except (OSError, requests.RequestException) as exc:
            logger.warning("MOSDAC download failed: %s", exc)
            if os.path.exists(partial_path):
                os.remove(partial_path)
            return None

    def parse_hdf5_granule(self, file_path: str) -> Dict[str, Any]:
        if h5py is None:
            raise RuntimeError("MOSDAC HDF5 support is unavailable. Install backend requirements with: pip install -r backend/requirements.txt")
        with h5py.File(file_path, "r") as hdf:
            hem_key = "HEM" if "HEM" in hdf else next(key for key in hdf.keys() if any(word in key.upper() for word in ("RAIN", "PRECIP", "MAXZ")))
            hem = hdf[hem_key]
            rainfall = hem[0, :, :] if len(hem.shape) == 3 else hem[:]
            fill_value = hem.attrs.get("_FillValue", -999.0)
            fill_value = float(fill_value[0] if isinstance(fill_value, np.ndarray) else fill_value)
            latitude = hdf["Latitude"][:] * float(hdf["Latitude"].attrs.get("scale_factor", 0.01))
            longitude = hdf["Longitude"][:] * float(hdf["Longitude"].attrs.get("scale_factor", 0.01))
            region = ((latitude >= STUDY_BBOX["min_lat"]) & (latitude <= STUDY_BBOX["max_lat"]) & (longitude >= STUDY_BBOX["min_lon"]) & (longitude <= STUDY_BBOX["max_lon"]))
            regional_rain = rainfall[region]
            regional_latitude = latitude[region]
            regional_longitude = longitude[region]
            valid = regional_rain[(regional_rain >= 0) & (regional_rain != fill_value)]
            points = [{"lat": round(float(regional_latitude[i]), 4), "lon": round(float(regional_longitude[i]), 4), "rain_mmh": round(float(regional_rain[i]), 2)} for i in range(min(150, len(regional_rain)))]
            return {"source": "ISRO_MOSDAC_INSAT3DR_HEM_DWR", "filename": os.path.basename(file_path), "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"), "total_points_in_mumbai": int(np.sum(region)), "max_rain_mmh": round(float(np.max(valid)) if len(valid) else 0.0, 2), "mean_rain_mmh": round(float(np.mean(valid)) if len(valid) else 0.0, 2), "spatial_samples": points, "status": "VALID_OBSERVATIONAL_DATA"}

    def sync_live_data(self) -> Dict[str, Any]:
        entries = self.search_latest_granules(count=3)
        file_path = None
        used_local_cache = bool(entries and entries[0].get("source") == "LOCAL_MOSDAC_CACHE")
        if entries and self.username and self.password:
            cached_path = os.path.join(self.raw_dir, entries[0]["identifier"])
            if os.path.exists(cached_path) and os.path.getsize(cached_path) > 100000:
                used_local_cache = True
            file_path = self.download_granule(entries[0]["id"], entries[0]["identifier"])
        if not file_path:
            local_files = glob.glob(os.path.join(self.raw_dir, "*.h5"))
            if local_files:
                file_path = max(local_files, key=os.path.getmtime)
                used_local_cache = True
        if not file_path:
            if not entries:
                raise RuntimeError("MOSDAC catalog returned no granules")
            if not self.username or not self.password:
                raise RuntimeError("MOSDAC credentials are not configured in this backend process")
            raise RuntimeError("MOSDAC granule download failed; check credentials and MOSDAC access")
        parsed = self.parse_hdf5_granule(file_path)
        if entries:
            parsed["entry_metadata"] = entries[0]
        parsed["acquisition_mode"] = "LOCAL_MOSDAC_CACHE" if used_local_cache else "LIVE_MOSDAC_CATALOG"
        self.latest_rainfall_field = parsed
        with open(self.processed_path, "w", encoding="utf-8") as data_file:
            json.dump(parsed, data_file, indent=2)
        return parsed

    def get_road_rainfall_intensity(self, road_lat: float, road_lon: float, t_min: int, scenario_id: Optional[str] = None) -> float:
        if self.latest_rainfall_field is None:
            self._load_cached_processed_data()
        if scenario_id == "mosdac_live_satellite_dwr":
            if not self.latest_rainfall_field:
                return 0.0
            samples = self.latest_rainfall_field.get("spatial_samples", [])
            if samples:
                nearest = min(
                    samples,
                    key=lambda sample: (sample["lat"] - road_lat) ** 2 + (sample["lon"] - road_lon) ** 2,
                )
                return max(0.0, round(float(nearest.get("rain_mmh", 0.0)), 2))
            return max(0.0, round(float(self.latest_rainfall_field.get("max_rain_mmh", 0.0)), 2))

        observed = self.latest_rainfall_field.get("max_rain_mmh", 45.0) if self.latest_rainfall_field else 45.0
        active_base = max(observed * 10.0, 75.0) if scenario_id == "mosdac_live_satellite_dwr" else 80.0
        center_lat = 19.062 + (t_min / 180.0) * 0.025
        center_lon = 72.870 + (t_min / 180.0) * 0.030
        distance = math.sqrt(((road_lat - center_lat) * 111.0) ** 2 + ((road_lon - center_lon) * 105.0) ** 2)
        time_factor = math.exp(-((t_min - 45.0) ** 2) / (2 * 35.0 ** 2))
        spatial_decay = math.exp(-(distance ** 2) / (2 * 2.2 ** 2))
        return max(0.0, round(active_base * (0.20 + 0.80 * time_factor) * (0.35 + 0.65 * spatial_decay), 2))


mosdac_service = MOSDACService()
