import React from 'react';
import { Activity, BarChart3, Droplets, Gauge, Route, ShieldAlert, Waves } from 'lucide-react';
import { RoutePlanResponse, SimulationResult, TimelineStep } from '../types';
import { Panel, SectionHeader, StatusPill, TelemetryChip } from './ui';

interface AnalyticsViewProps {
  simulation: SimulationResult | null;
  currentStepIndex: number;
  selectedRoute?: RoutePlanResponse | null;
}

const chartWidth = 760;
const chartHeight = 220;
const chartPad = { left: 42, right: 18, top: 18, bottom: 30 };

const getMax = (values: number[]) => Math.max(...values, 1);
const formatNumber = (value: number) => Number.isInteger(value) ? value.toString() : value.toFixed(1);

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ simulation, currentStepIndex, selectedRoute }) => {
  if (!simulation) return null;

  const timeline = simulation.timeline || [];
  const currentStep: TimelineStep | undefined = timeline[currentStepIndex];
  const rainfall = timeline.map((step) => step.current_rainfall_peak_mmh || 0);
  const depthByRoad = Object.values(currentStep?.roads || {})
    .sort((a, b) => b.water_depth_cm - a.water_depth_cm)
    .slice(0, 8);
  const utilization = Object.values(currentStep?.drainage_edges || {})
    .sort((a, b) => b.utilization_pct - a.utilization_pct)
    .slice(0, 8);
  const activeAlerts = (simulation.alerts || []).filter((alert) => alert.time_min <= (currentStep?.time_minute || 0));
  const criticalAlerts = activeAlerts.filter((alert) => alert.severity === 'CRITICAL').length;
  const peakRain = Math.max(...rainfall, 0);
  const avgDepth = depthByRoad.length ? depthByRoad.reduce((sum, road) => sum + road.water_depth_cm, 0) / depthByRoad.length : 0;
  const maxUtilization = utilization.length ? utilization[0].utilization_pct : 0;
  const routeRoads = Object.values(currentStep?.roads || {});
  const safeRoads = routeRoads.filter((road) => road.is_passable_ambulance).sort((a, b) => a.water_depth_cm - b.water_depth_cm);
  const routeReady = safeRoads.length;
  const routeBlocked = routeRoads.length - routeReady;
  const routeReadyPercent = routeRoads.length ? Math.round((routeReady / routeRoads.length) * 100) : 0;
  const routeDonutStyle = { background: `conic-gradient(#00e5a8 0deg ${routeReadyPercent * 3.6}deg, #ff3b4d ${routeReadyPercent * 3.6}deg 360deg)` };

  const linePoints = rainfall.map((value, index) => {
    const x = chartPad.left + (index / Math.max(1, rainfall.length - 1)) * (chartWidth - chartPad.left - chartPad.right);
    const y = chartPad.top + (1 - value / getMax(rainfall)) * (chartHeight - chartPad.top - chartPad.bottom);
    return `${x},${y}`;
  }).join(' ');
  const areaPoints = `${chartPad.left},${chartHeight - chartPad.bottom} ${linePoints} ${chartWidth - chartPad.right},${chartHeight - chartPad.bottom}`;

  return (
    <div className="h-full bg-[#060b16] p-6 overflow-y-auto font-sans command-enter">
      <div className="w-full max-w-[1600px] mx-auto space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <SectionHeader icon={BarChart3} eyebrow="Power BI-style operational view" title="Flood Intelligence Analytics" accent="blue" />
            <p className="text-xs text-slate-400 font-mono mt-2 max-w-2xl">Decision-ready indicators derived from the active nowcast, road inundation model, drainage hydraulics, and alert stream.</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill label="Model output" tone="simulation" />
            <TelemetryChip label="Forecast step" value={`T+${currentStep?.time_minute || 0}m`} tone="cyan" />
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <Panel className="metric-card metric-cyan p-4"><div className="flex justify-between"><Droplets className="w-4 h-4 text-cyan-300" /><span className="eyebrow">Peak rainfall</span></div><div className="metric-number text-cyan-200">{formatNumber(peakRain)} <small>mm/hr</small></div><div className="metric-caption">Across the 0–3h forecast</div></Panel>
          <Panel className="metric-card metric-danger p-4"><div className="flex justify-between"><ShieldAlert className="w-4 h-4 text-red-300" /><span className="eyebrow">Critical alerts</span></div><div className="metric-number text-red-200">{criticalAlerts}</div><div className="metric-caption">Triggered by current step</div></Panel>
          <Panel className="metric-card metric-warning p-4"><div className="flex justify-between"><Waves className="w-4 h-4 text-amber-300" /><span className="eyebrow">Top hydraulic load</span></div><div className="metric-number text-amber-200">{formatNumber(maxUtilization)}<small>%</small></div><div className="metric-caption">Highest conduit utilization</div></Panel>
          <Panel className="metric-card metric-teal p-4"><div className="flex justify-between"><Activity className="w-4 h-4 text-teal-300" /><span className="eyebrow">Avg. top-road depth</span></div><div className="metric-number text-teal-200">{formatNumber(avgDepth)}<small> cm</small></div><div className="metric-caption">Current ranked segments</div></Panel>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.65fr] gap-5">
          <Panel className="p-5" accent="cyan">
            <div className="flex items-center justify-between mb-4"><SectionHeader icon={Droplets} eyebrow="Time series" title="Rainfall intensity forecast" accent="cyan" /><span className="text-[10px] text-slate-500 font-mono">mm/hr · 10 min steps</span></div>
            <div className="analytics-chart-wrap">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto" role="img" aria-label="Rainfall intensity forecast chart">
                {[0, 0.25, 0.5, 0.75, 1].map((fraction) => { const y = chartPad.top + fraction * (chartHeight - chartPad.top - chartPad.bottom); return <line key={fraction} x1={chartPad.left} x2={chartWidth - chartPad.right} y1={y} y2={y} className="analytics-gridline" />; })}
                <polygon points={areaPoints} className="analytics-area" />
                <polyline points={linePoints} className="analytics-line" />
                {rainfall.map((value, index) => { const x = chartPad.left + (index / Math.max(1, rainfall.length - 1)) * (chartWidth - chartPad.left - chartPad.right); const y = chartPad.top + (1 - value / getMax(rainfall)) * (chartHeight - chartPad.top - chartPad.bottom); return <circle key={index} cx={x} cy={y} r={index === currentStepIndex ? 5 : 2.5} className={index === currentStepIndex ? 'analytics-point analytics-point-active' : 'analytics-point'} />; })}
                <text x={chartPad.left} y={chartHeight - 8} className="analytics-axis">T+0m</text><text x={chartWidth - chartPad.right} y={chartHeight - 8} textAnchor="end" className="analytics-axis">T+{timeline[timeline.length - 1]?.time_minute || 180}m</text>
                <text x={chartPad.left - 8} y={chartPad.top + 4} textAnchor="end" className="analytics-axis">{formatNumber(peakRain)}</text><text x={chartPad.left - 8} y={chartHeight - chartPad.bottom} textAnchor="end" className="analytics-axis">0</text>
              </svg>
            </div>
          </Panel>

          <Panel className="p-5" accent="danger">
            <div className="flex items-center justify-between mb-4"><SectionHeader icon={ShieldAlert} eyebrow="Ranked exposure" title="Most vulnerable roads" accent="danger" /><span className="text-[10px] text-slate-500 font-mono">T+{currentStep?.time_minute || 0}m</span></div>
            <div className="space-y-3">{depthByRoad.map((road) => <div key={road.road_id}><div className="flex justify-between gap-3 text-xs mb-1"><span className="text-slate-300 truncate">{road.name}</span><span className="font-mono text-red-200">{formatNumber(road.water_depth_cm)} cm</span></div><div className="analytics-bar"><span className="analytics-bar-fill analytics-bar-danger" style={{ width: `${Math.min(100, (road.water_depth_cm / Math.max(depthByRoad[0]?.water_depth_cm || 1, 1)) * 100)}%` }} /></div></div>)}</div>
          </Panel>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[0.8fr_1.2fr] gap-5">
        <Panel className="p-5" accent="purple">
          <div className="flex items-center justify-between mb-4"><SectionHeader icon={ShieldAlert} eyebrow="Route readiness" title="Safer route outlook" accent="purple" /><StatusPill label={`${routeReadyPercent}% ready`} tone={routeReadyPercent >= 70 ? 'safe' : 'warning'} /></div>
          <div className="flex items-center gap-6">
            <div className="analytics-donut" style={routeDonutStyle}><div className="analytics-donut-hole"><strong>{routeReadyPercent}%</strong><span>ready roads</span></div></div>
            <div className="space-y-3 text-xs font-mono flex-1">
              <div className="flex items-center justify-between"><span className="text-slate-400"><i className="analytics-legend-dot analytics-legend-safe" />Ambulance-passable</span><strong className="text-teal-200">{routeReady}</strong></div>
              <div className="flex items-center justify-between"><span className="text-slate-400"><i className="analytics-legend-dot analytics-legend-danger" />Blocked / unsafe</span><strong className="text-red-200">{routeBlocked}</strong></div>
              <div className="pt-2 border-t border-white/[0.07] text-slate-500">Based on the active forecast step and existing road clearance fields.</div>
            </div>
          </div>
          {selectedRoute && <div className="route-summary-strip mt-5"><span>Selected route</span><strong>{selectedRoute.safe_route_found ? 'SAFE ROUTE FOUND' : 'NO SAFE ROUTE'}</strong><span>{selectedRoute.safe_route_max_depth_cm} cm max · {selectedRoute.safe_route_eta_min} min ETA</span></div>}
        </Panel>

        <Panel className="p-5" accent="teal">
          <div className="flex items-center justify-between mb-4"><SectionHeader icon={Route} eyebrow="Response corridors" title="Safer roads at current forecast step" accent="teal" /><span className="text-[10px] text-slate-500 font-mono">Ambulance clearance · T+{currentStep?.time_minute || 0}m</span></div>
          {safeRoads.length ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-3">
              {safeRoads.map((road, index) => {
                const clearanceMargin = Math.max(0, 20 - road.water_depth_cm);
                const barWidth = Math.max(12, (clearanceMargin / 20) * 100);
                const hue = 158 + (index % 6) * 18;
                return (
                  <div key={road.road_id} className="safe-road-row">
                    <div className="flex justify-between gap-3 text-xs mb-1"><span className="text-slate-300 truncate"><span className="safe-road-rank">{String(index + 1).padStart(2, '0')}</span>{road.name}</span><span className="font-mono text-teal-200">{formatNumber(road.water_depth_cm)} cm</span></div>
                    <div className="safe-road-track"><span className="safe-road-fill" style={{ width: `${barWidth}%`, background: `linear-gradient(90deg, hsl(${hue} 78% 42%), hsl(${hue + 22} 82% 64%))` }} /></div>
                    <div className="flex justify-between text-[10px] mt-1 font-mono text-slate-500"><span>Clearance margin</span><span className="text-teal-300">{formatNumber(clearanceMargin)} cm</span></div>
                  </div>
                );
              })}
            </div>
          ) : <div className="analytics-empty">No ambulance-passable roads at the active forecast step.</div>}
        </Panel>

        <Panel className="p-5" accent="amber">
          <div className="flex items-center justify-between mb-4"><SectionHeader icon={Gauge} eyebrow="Hydraulic network" title="Conduit utilization" accent="amber" /><span className="text-[10px] text-slate-500 font-mono">Capacity pressure by edge</span></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">{utilization.map((edge) => <div key={edge.edge_id}><div className="flex justify-between text-xs mb-1"><span className="text-slate-300 font-mono">{edge.edge_id}</span><span className={edge.utilization_pct >= 100 ? 'text-red-300' : edge.utilization_pct >= 80 ? 'text-amber-300' : 'text-teal-300'}>{formatNumber(edge.utilization_pct)}%</span></div><div className="analytics-bar"><span className={`analytics-bar-fill ${edge.utilization_pct >= 100 ? 'analytics-bar-danger' : edge.utilization_pct >= 80 ? 'analytics-bar-warning' : 'analytics-bar-teal'}`} style={{ width: `${Math.min(100, edge.utilization_pct)}%` }} /></div></div>)}</div>
        </Panel>
        </div>
      </div>
    </div>
  );
};
