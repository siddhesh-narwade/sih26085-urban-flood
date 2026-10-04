import React, { Suspense, useEffect, useState } from 'react';
import { Database, ShieldCheck, FileText, CheckCircle2, AlertCircle, RefreshCw, Radio, Search, ChevronRight, ExternalLink } from 'lucide-react';
import { api } from '../services/api';
import { MosdacStatus } from '../services/api';
import { DataLayerMetadata } from '../types';
import { ProvenanceTier } from './ProvenanceScene3D';

const ProvenanceScene3D = React.lazy(() => import('./ProvenanceScene3D').then(({ ProvenanceScene3D: Scene }) => ({ default: Scene })));

export const ProvenanceModal: React.FC = () => {
  const [layers, setLayers] = useState<DataLayerMetadata[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [mosdacStatus, setMosdacStatus] = useState<MosdacStatus | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTier, setActiveTier] = useState<ProvenanceTier | null>(null);
  const [query, setQuery] = useState<string>('');
  const [selectedLayerName, setSelectedLayerName] = useState<string | null>(null);

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

  const visibleLayers = activeTier
    ? layers.filter((layer) => activeTier === 'REAL'
      ? layer.classification.startsWith('REAL')
      : activeTier === 'DERIVED'
        ? layer.classification.startsWith('DERIVED')
        : !layer.classification.startsWith('REAL') && !layer.classification.startsWith('DERIVED'))
    : layers;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredLayers = visibleLayers.filter((layer) => !normalizedQuery || [
    layer.layer_name,
    layer.classification,
    layer.source,
    layer.license,
    layer.spatial_resolution,
    layer.temporal_resolution,
    layer.notes
  ].join(' ').toLocaleLowerCase().includes(normalizedQuery));
  const selectedLayer = filteredLayers.find((layer) => layer.layer_name === selectedLayerName) ?? filteredLayers[0] ?? null;

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

        <Suspense fallback={<div className="provenance-scene provenance-scene-loading" aria-label="Loading provenance constellation" />}>
          <ProvenanceScene3D layers={layers} activeTier={activeTier} onSelectTier={setActiveTier} />
        </Suspense>

        {/* Data Tiers Legend */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
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
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold text-sm text-white uppercase tracking-wider font-mono">Dataset Registry & Licensing Attributes</h3>
              {activeTier && <button type="button" className="provenance-clear-filter" onClick={() => setActiveTier(null)}>CLEAR TIER FILTER ×</button>}
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs font-mono text-slate-400">Loading dataset registry...</div>
          ) : (
            <>
              <div className="provenance-registry-toolbar">
                <label className="provenance-search">
                  <Search className="w-4 h-4" aria-hidden="true" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Search source, license, resolution…" aria-label="Search provenance records" />
                  {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search">×</button>}
                </label>
                <span className="provenance-result-count">{filteredLayers.length} / {layers.length} RECORDS</span>
              </div>
              <div className="provenance-explorer">
                <div className="provenance-source-list" role="listbox" aria-label="Dataset provenance records">
                  {filteredLayers.map((layer, index) => {
                    const tierClass = layer.classification.startsWith('REAL') ? 'real' : layer.classification.startsWith('DERIVED') ? 'derived' : 'simulated';
                    const selected = selectedLayer?.layer_name === layer.layer_name;
                    return (
                      <button
                        key={layer.layer_name}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={`provenance-source-item provenance-source-${tierClass} ${selected ? 'is-selected' : ''}`}
                        onClick={() => setSelectedLayerName(layer.layer_name)}
                      >
                        <span className="provenance-source-index">{String(index + 1).padStart(2, '0')}</span>
                        <span className="provenance-source-copy">
                          <strong>{layer.layer_name}</strong>
                          <small>{layer.source}</small>
                        </span>
                        <span className="provenance-source-classification">{layer.classification.replace('_', ' ')}</span>
                        <ChevronRight className="provenance-source-chevron w-4 h-4" />
                      </button>
                    );
                  })}
                  {!filteredLayers.length && <div className="provenance-no-results">NO MATCHING DATASETS</div>}
                </div>

                <article className="provenance-record-detail" aria-live="polite">
                  {selectedLayer ? (
                    <>
                      <div className="provenance-detail-kicker"><FileText className="w-3.5 h-3.5" /> SELECTED EVIDENCE</div>
                      <div className="provenance-detail-heading">
                        <h4>{selectedLayer.layer_name}</h4>
                        <span className={`provenance-detail-tier provenance-detail-tier-${selectedLayer.classification.startsWith('REAL') ? 'real' : selectedLayer.classification.startsWith('DERIVED') ? 'derived' : 'simulated'}`}>
                          {selectedLayer.classification}
                        </span>
                      </div>
                      <p className="provenance-detail-notes">{selectedLayer.notes}</p>
                      <div className="provenance-detail-facts">
                        <div className="provenance-fact provenance-fact-source"><span>SOURCE</span><p>{selectedLayer.source}</p></div>
                        <div className="provenance-fact provenance-fact-license"><span>LICENSE</span><p><ShieldCheck className="w-3.5 h-3.5" />{selectedLayer.license}</p></div>
                        <div className="provenance-fact"><span>SPATIAL RESOLUTION</span><p>{selectedLayer.spatial_resolution}</p></div>
                        <div className="provenance-fact"><span>TEMPORAL RESOLUTION</span><p>{selectedLayer.temporal_resolution}</p></div>
                      </div>
                      <div className="provenance-detail-footer"><ExternalLink className="w-3 h-3" /> METADATA FROM ACTIVE BACKEND REGISTRY</div>
                    </>
                  ) : (
                    <div className="provenance-no-results">{normalizedQuery ? 'NO RECORD MATCHES THIS SEARCH' : 'SELECT A DATASET TO INSPECT ITS PROVENANCE'}</div>
                  )}
                </article>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
