import axios from 'axios';
import { 
  SimulationResult, 
  FloodExplainResponse, 
  RoutePlanResponse, 
  DataLayerMetadata 
} from '../types';

const API_BASE = '/api';

export const api = {
  // Simulation
  getScenarios: async () => {
    const res = await axios.get(`${API_BASE}/simulation/scenarios`);
    return res.data;
  },
  getCurrentSimulation: async (): Promise<SimulationResult> => {
    const res = await axios.get(`${API_BASE}/simulation/current`);
    return res.data;
  },
  runSimulation: async (params: {
    scenario_id?: string;
    rainfall_intensity_multiplier?: number;
    blockage_percentage?: number;
    conduit_capacity_multiplier?: number;
    tide_level_m?: number;
    horizon_minutes?: number;
    time_step_min?: number;
  }): Promise<SimulationResult> => {
    const res = await axios.post(`${API_BASE}/simulation/run`, params);
    return res.data;
  },
  explainFlooding: async (roadId: string, timeMin: number): Promise<FloodExplainResponse> => {
    const res = await axios.get(`${API_BASE}/simulation/explain/${roadId}`, {
      params: { time_min: timeMin }
    });
    return res.data;
  },

  // Geospatial Data Layers
  getRoads: async () => {
    const res = await axios.get(`${API_BASE}/data/roads`);
    return res.data;
  },
  getDrainageNodes: async () => {
    const res = await axios.get(`${API_BASE}/drainage/nodes`);
    return res.data;
  },
  getDrainageEdges: async () => {
    const res = await axios.get(`${API_BASE}/drainage/edges`);
    return res.data;
  },
  getPOIs: async () => {
    const res = await axios.get(`${API_BASE}/data/poi`);
    return res.data;
  },
  getDEM: async () => {
    const res = await axios.get(`${API_BASE}/data/dem`);
    return res.data;
  },
  getDwrStatus: async () => {
    const res = await axios.get(`${API_BASE}/data/dwr/status`);
    return res.data;
  },
  refreshDwrData: async () => {
    const res = await axios.post(`${API_BASE}/data/dwr/refresh`);
    return res.data;
  },
  getMosdacStatus: async () => {
    const res = await axios.get(`${API_BASE}/data/mosdac/status`);
    return res.data;
  },
  syncMosdac: async () => {
    const res = await axios.post(`${API_BASE}/data/mosdac/sync`);
    return res.data;
  },
  getMosdacGranules: async () => {
    const res = await axios.get(`${API_BASE}/data/mosdac/granules`);
    return res.data;
  },
  getProvenance: async (): Promise<DataLayerMetadata[]> => {
    const res = await axios.get(`${API_BASE}/data/provenance`);
    return res.data;
  },
  getHealth: async () => {
    const res = await axios.get(`${API_BASE}/data/health`);
    return res.data;
  },

  // Routing
  getRouteNodes: async () => {
    const res = await axios.get(`${API_BASE}/route/nodes`);
    return res.data;
  },
  getVehicleProfiles: async () => {
    const res = await axios.get(`${API_BASE}/route/profiles`);
    return res.data;
  },
  planRoute: async (params: {
    start_node_id: string;
    destination_node_id: string;
    vehicle_type: string;
    time_minute: number;
  }): Promise<RoutePlanResponse> => {
    const res = await axios.post(`${API_BASE}/route/plan`, params);
    return res.data;
  }
};
