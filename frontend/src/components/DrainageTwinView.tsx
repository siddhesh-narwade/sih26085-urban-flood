import React, { Suspense, useState } from 'react';
import { 
  Activity, 
  Gauge, 
  AlertTriangle, 
  CheckCircle2, 
  Zap, 
  ArrowDownCircle,
  Database
} from 'lucide-react';
import { SimulationResult, TimelineStep } from '../types';

const DrainageNetworkScene = React.lazy(() => import('./DrainageNetworkScene').then(({ DrainageNetworkScene: Scene }) => ({ default: Scene })));

interface DrainageTwinViewProps {
  simulation: SimulationResult | null;
  currentStepIndex: number;
  drainageNodesGeoJSON: any;
  drainageEdgesGeoJSON: any;
}

export const DrainageTwinView: React.FC<DrainageTwinViewProps> = ({
  simulation,
  currentStepIndex,
  drainageNodesGeoJSON,
  drainageEdgesGeoJSON
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NORMAL' | 'WARNING' | 'SURCHARGE'>('ALL');
  const [selectedConduitId, setSelectedConduitId] = useState<string | null>(null);
  const currentStep: TimelineStep | undefined = simulation?.timeline[currentStepIndex];

  if (!simulation || !currentStep) return null;

  const nodeStats = Object.values(currentStep.drainage_nodes || {});
  const edgeStats = Object.values(currentStep.drainage_edges || {});

  const surchargingNodes = nodeStats.filter((n) => n.is_surcharged);
  const overloadedEdges = edgeStats.filter((e) => e.utilization_pct >= 90.0);
  const visibleEdges = statusFilter === 'ALL' ? edgeStats : edgeStats.filter((edge) => edge.status === statusFilter);
  const selectedEdge = edgeStats.find((edge) => edge.edge_id === selectedConduitId) ?? null;
  const selectedLoadColor = selectedEdge?.status === 'SURCHARGE' || (selectedEdge?.utilization_pct ?? 0) >= 100
    ? '#ff4c98'
    : (selectedEdge?.utilization_pct ?? 0) >= 80 ? '#ffb642' : '#38dff0';

  const avgUtil = edgeStats.length > 0
    ? edgeStats.reduce((acc, e) => acc + e.utilization_pct, 0) / edgeStats.length
    : 0;

  return (
    <div className="h-full w-full min-w-0 bg-[#060b16] p-6 overflow-y-auto font-sans space-y-6 command-enter">
      <div className="w-full max-w-6xl min-w-0 mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2 text-cyan-300">
              <Activity className="w-5 h-5" />
              <h2 className="font-extrabold text-base tracking-wider uppercase">
                Underground Stormwater Drainage Digital Twin
              </h2>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Real-time Manning hydraulic conveyance, junction water balances, and surcharge backflow telemetry at <span className="text-sky-400 font-bold">T + {currentStep.time_minute} min</span>.
            </p>
          </div>

          <div className="command-panel px-4 py-2 rounded-xl text-xs font-mono">
            <span className="text-slate-400">Network Utilization:</span>
            <span className={`font-bold ${avgUtil > 80 ? 'text-pink-400' : 'text-emerald-400'}`}>
              {avgUtil.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Top Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 font-mono text-center">
          <div className="metric-card metric-teal command-panel p-4">
            <div className="text-[10px] uppercase text-slate-400">Active Inlets & Manholes</div>
            <div className="text-2xl font-bold text-white mt-1">{nodeStats.length}</div>
            <div className="text-[10px] text-slate-500 mt-1">18 Monitored Junctions</div>
          </div>

          <div className="metric-card metric-cyan command-panel p-4">
            <div className="text-[10px] uppercase text-slate-400">Stormwater Conduits</div>
            <div className="text-2xl font-bold text-sky-400 mt-1">{edgeStats.length}</div>
            <div className="text-[10px] text-slate-500 mt-1">Ø600 – 1800mm RCC</div>
          </div>

          <div className="metric-card metric-danger command-panel command-panel-danger p-4">
            <div className="text-[10px] uppercase text-slate-400">Surcharging Nodes</div>
            <div className={`text-2xl font-bold mt-1 ${surchargingNodes.length > 0 ? 'text-pink-400 animate-pulse' : 'text-emerald-400'}`}>
              {surchargingNodes.length}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Active Backflow Outlets</div>
          </div>

          <div className="metric-card metric-warning command-panel command-panel-amber p-4">
            <div className="text-[10px] uppercase text-slate-400">Overloaded Trunk Lines</div>
            <div className={`text-2xl font-bold mt-1 ${overloadedEdges.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {overloadedEdges.length}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">&ge;90% Hydraulic Load</div>
          </div>
        </div>

        <Suspense fallback={<div className="drainage-scene-shell drainage-scene-loading" aria-label="Loading 3D drainage network" />}>
          <DrainageNetworkScene
            nodeFeatures={drainageNodesGeoJSON?.features || []}
            edgeFeatures={drainageEdgesGeoJSON?.features || []}
            nodeStats={currentStep.drainage_nodes || {}}
            edgeStats={currentStep.drainage_edges || {}}
            timeMinute={currentStep.time_minute}
            selectedConduitId={selectedConduitId}
            onConduitSelect={(edgeId) => {
              setSelectedConduitId(edgeId);
              if (edgeId) setStatusFilter('ALL');
            }}
          />
        </Suspense>

        {/* Active Surcharge Alert Callout (if any) */}
        {surchargingNodes.length > 0 && (
          <div className="p-4 rounded-2xl bg-pink-500/10 border border-pink-500/40 text-xs font-mono text-pink-300 space-y-1 command-enter">
            <div className="flex items-center space-x-2 font-bold text-sm text-pink-400">
              <AlertTriangle className="w-4 h-4" />
              <span>HYDRAULIC SURCHARGE ACTIVE — WATER REVERSING TO SURFACE</span>
            </div>
            <div>
              {surchargingNodes.map((n) => `${n.node_id} (Inflow: ${n.inflow_m3s} m³/s, Surcharge: ${n.surcharge_m3s} m³/s)`).join(' • ')}
            </div>
          </div>
        )}

        {/* Conduits Hydraulics Table */}
        <div className="command-panel rounded-2xl overflow-hidden">
          <div className="hydraulic-panel-heading">
            <h3 className="font-bold text-sm text-white uppercase tracking-wider font-mono flex items-center space-x-2">
              <Gauge className="w-4 h-4 text-sky-400" />
              <span>Stormwater Conduits Hydraulic Telemetry</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">Formula: Manning full-pipe equation</span>
          </div>

          <div className="hydraulic-table-toolbar">
            <div className="hydraulic-status-filters" aria-label="Filter conduits by hydraulic status">
              {(['ALL', 'NORMAL', 'WARNING', 'SURCHARGE'] as const).map((status) => {
                const count = status === 'ALL' ? edgeStats.length : edgeStats.filter((edge) => edge.status === status).length;
                return <button key={status} type="button" className={`hydraulic-status-filter hydraulic-status-${status.toLowerCase()} ${statusFilter === status ? 'is-active' : ''}`} aria-pressed={statusFilter === status} onClick={() => setStatusFilter(status)}><span>{status}</span><strong>{count}</strong></button>;
              })}
            </div>
            <span className="hydraulic-filter-caption">{visibleEdges.length} CONDUITS SHOWN · T+{currentStep.time_minute} MIN</span>
          </div>

          {selectedEdge && (
            <div className="hydraulic-selected-inspector" style={{ '--load-color': selectedLoadColor } as React.CSSProperties}>
              <div className="hydraulic-inspector-heading">
                <div><span>SELECTED CONDUIT</span><strong>{selectedEdge.edge_id} <i>{selectedEdge.from_node} → {selectedEdge.to_node}</i></strong></div>
                <button type="button" aria-label="Clear selected conduit" title="Clear selection" onClick={() => setSelectedConduitId(null)}>×</button>
              </div>
              <div className="hydraulic-inspector-content">
                <div className="hydraulic-load-dial" role="meter" aria-label={`${selectedEdge.edge_id} utilization`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, selectedEdge.utilization_pct)} style={{ '--load-angle': `${Math.min(100, Math.max(0, selectedEdge.utilization_pct)) * 3.6}deg` } as React.CSSProperties}>
                  <div><strong>{selectedEdge.utilization_pct}%</strong><span>LOAD</span></div>
                </div>
                <div className="hydraulic-inspector-metrics">
                  <div><span>LIVE FLOW</span><strong>{selectedEdge.flow_m3s} <i>m³/s</i></strong></div>
                  <div><span>PIPE CAPACITY</span><strong>{selectedEdge.capacity_m3s} <i>m³/s</i></strong></div>
                  <div><span>VELOCITY</span><strong>{selectedEdge.velocity_ms} <i>m/s</i></strong></div>
                  <div><span>CAPACITY MARGIN</span><strong>{(selectedEdge.capacity_m3s - selectedEdge.flow_m3s).toFixed(3)} <i>m³/s</i></strong></div>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3">Conduit ID</th>
                  <th className="px-6 py-3">From Node</th>
                  <th className="px-6 py-3">To Node</th>
                  <th className="px-6 py-3">Flow (m³/s)</th>
                  <th className="px-6 py-3">Capacity (m³/s)</th>
                  <th className="px-6 py-3">Velocity (m/s)</th>
                  <th className="px-6 py-3">Utilization</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {visibleEdges.map((edge, index) => (
                  <tr key={edge.edge_id} tabIndex={0} aria-selected={selectedConduitId === edge.edge_id} onClick={() => setSelectedConduitId((selected) => selected === edge.edge_id ? null : edge.edge_id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedConduitId((selected) => selected === edge.edge_id ? null : edge.edge_id); } }} className={`hydraulic-conduit-row ${selectedConduitId === edge.edge_id ? 'is-selected' : ''}`}>
                    <td className="px-6 py-3 font-bold text-sky-400">{edge.edge_id}</td>
                    <td className="px-6 py-3 text-slate-300">{edge.from_node}</td>
                    <td className="px-6 py-3 text-slate-300">{edge.to_node}</td>
                    <td className="px-6 py-3 text-white font-bold">{edge.flow_m3s}</td>
                    <td className="px-6 py-3 text-slate-400">{edge.capacity_m3s}</td>
                    <td className="px-6 py-3 text-slate-300">{edge.velocity_ms} m/s</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`hydraulic-util-fill chart-fill-in h-full rounded-full ${
                              edge.utilization_pct >= 100 ? 'bg-pink-500' :
                              edge.utilization_pct >= 80 ? 'bg-amber-400' : 'bg-sky-400'
                            }`}
                            style={{ width: `${Math.min(100, edge.utilization_pct)}%`, '--bar-delay': `${Math.min(index, 12) * 40}ms` } as React.CSSProperties}
                          />
                        </div>
                        <span className={`font-bold ${
                          edge.utilization_pct >= 100 ? 'text-pink-400' :
                          edge.utilization_pct >= 80 ? 'text-amber-400' : 'text-slate-300'
                        }`}>
                          {edge.utilization_pct}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        edge.status === 'SURCHARGE' ? 'bg-pink-500/20 text-pink-400 border border-pink-500/40 animate-pulse' :
                        edge.status === 'WARNING' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                        'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      }`}>
                        {edge.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
