import React, { useEffect, useState } from 'react';
import { Database, ShieldCheck, FileText, CheckCircle2, AlertCircle, RefreshCw, Radio } from 'lucide-react';
import { api } from '../services/api';
import { MosdacStatus } from '../services/api';
import { DataLayerMetadata } from '../types';

export const ProvenanceModal: React.FC = () => {
  const [layers, setLayers] = useState<DataLayerMetadata[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [mosdacStatus, setMosdacStatus] = useState<MosdacStatus | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchProvenance = async () => {
    setRefreshing(true);
      try {
        const [data, status] = await Promise.all([api.getProvenance(), api.getMosdacStatus()]);
        setLayers(data);
        setMosdacStatus(status);
      } catch (err) {
        console.error("Failed to load provenance:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
  };

  useEffect(() => {
    fetchProvenance();
  }, []);

  return (
    <div className="h-full bg-[#060b16] p-6 overflow-y-auto font-sans space-y-6 command-enter">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center space-x-2 text-sky-400">
            <Database className="w-5 h-5" />
            <h2 className="font-extrabold text-base tracking-wider uppercase">
              Scientific Data Provenance & Metadata Registry
            </h2>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Strict scientific classification matrix differentiating Real Public Data, Derived Topographic Features, and Simulated Municipal Drainage Infrastructure.
          </p>
        </div>

        {mosdacStatus && (
          <div className={`command-panel p-5 ${mosdacStatus.acquisition_mode === 'LIVE_MOSDAC_CATALOG' ? 'command-panel-teal' : 'command-panel-cyan'}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Radio className={`w-5 h-5 ${mosdacStatus.acquisition_mode === 'LIVE_MOSDAC_CATALOG' ? 'text-emerald-400' : 'text-sky-400'}`} />
                <div>
                  <h3 className="font-bold text-sm text-white uppercase tracking-wider">MOSDAC DWR Evidence</h3>
                  <p className="text-[11px] text-slate-400 font-mono">Backend status from /api/data/mosdac/status</p>
                </div>
              </div>
              <button onClick={fetchProvenance} disabled={refreshing} className="p-2 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800" title="Refresh MOSDAC backend status">
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 text-xs font-mono">
              <div><div className="text-slate-500">Acquisition</div><div className="text-emerald-300 font-bold mt-1">{mosdacStatus.acquisition_mode}</div></div>
              <div><div className="text-slate-500">Granule</div><div className="text-slate-200 mt-1 break-all">{mosdacStatus.active_file}</div></div>
              <div><div className="text-slate-500">Parsed At</div><div className="text-slate-200 mt-1">{mosdacStatus.last_sync}</div></div>
              <div><div className="text-slate-500">Rainfall</div><div className="text-sky-300 mt-1">{mosdacStatus.max_rain_mmh} mm/hr max</div></div>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-4">Source: {mosdacStatus.backend_source} | Dataset: {mosdacStatus.dataset_id} | Field: {mosdacStatus.status}</p>
          </div>
        )}

        {/* Data Tiers Legend */}
        <div className="grid grid-cols-3 gap-4">
          <div className="metric-card metric-teal command-panel command-panel-teal p-4">
            <div className="flex items-center space-x-2 font-bold text-xs text-emerald-400 font-mono uppercase">
              <CheckCircle2 className="w-4 h-4" />
              <span>Tier A — Real Public Data</span>
            </div>
            <p className="text-xs text-slate-300 mt-2">
              Authentic open municipal datasets: OpenStreetMap road geometry, MCGM hospitals, fire stations, and Mithi River alignment.
            </p>
          </div>

          <div className="metric-card metric-cyan command-panel command-panel-cyan p-4">
            <div className="flex items-center space-x-2 font-bold text-xs text-sky-400 font-mono uppercase">
              <CheckCircle2 className="w-4 h-4" />
              <span>Tier B — Derived Topography</span>
            </div>
            <p className="text-xs text-slate-300 mt-2">
              Copernicus GLO-30 / SRTM 30m DEM resampled with D8 steepest descent flow directions, slope gradients, and imperviousness fractions.
            </p>
          </div>

          <div className="metric-card metric-warning command-panel command-panel-amber p-4">
            <div className="flex items-center space-x-2 font-bold text-xs text-amber-400 font-mono uppercase">
              <AlertCircle className="w-4 h-4" />
              <span>Tier C — Prototype Simulation</span>
            </div>
            <p className="text-xs text-slate-300 mt-2">
              Synthesized underground stormwater conduits, manhole depths, and Manning capacities based on standard Indian municipal engineering codes.
            </p>
          </div>
        </div>

        {/* Table of Layers */}
        <div className="command-panel rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h3 className="font-bold text-sm text-white uppercase tracking-wider font-mono">
              Dataset Registry & Licensing Attributes
            </h3>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs font-mono text-slate-400">Loading dataset registry...</div>
          ) : (
            <div className="divide-y divide-slate-800">
              {layers.map((layer, idx) => (
                <div key={idx} className="p-5 hover:bg-slate-900/40 transition-colors space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">{layer.layer_name}</span>
                    <span className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold ${
                      layer.classification.includes('REAL') ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                      layer.classification.includes('DERIVED') ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' :
                      'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}>
                      {layer.classification}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs font-mono text-slate-400">
                    <div><span className="text-slate-500">Source:</span> {layer.source}</div>
                    <div><span className="text-slate-500">License:</span> {layer.license}</div>
                    <div><span className="text-slate-500">Spatial Resolution:</span> {layer.spatial_resolution}</div>
                    <div><span className="text-slate-500">Temporal Resolution:</span> {layer.temporal_resolution}</div>
                  </div>
                  <p className="text-xs text-slate-300 pt-1 font-mono">{layer.notes}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
