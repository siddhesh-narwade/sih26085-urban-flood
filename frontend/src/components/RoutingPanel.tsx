import React, { useEffect, useState } from 'react';
import { 
  Navigation, 
  ShieldCheck, 
  AlertOctagon, 
  Clock, 
  MapPin, 
  Truck, 
  Car, 
  Bus, 
  Zap,
  ArrowRight,
  CheckCircle2,
  Building2
} from 'lucide-react';
import { api } from '../services/api';
import { RoutePlanResponse } from '../types';

interface RoutingPanelProps {
  currentStepTimeMin: number;
  onRouteCalculated: (route: RoutePlanResponse | null) => void;
}

export const RoutingPanel: React.FC<RoutingPanelProps> = ({
  currentStepTimeMin,
  onRouteCalculated
}) => {
  const [junctions, setJunctions] = useState<Array<{ id: string; name: string }>>([]);
  const [startNode, setStartNode] = useState<string>('J_KURLA_STN');
  const [destNode, setDestNode] = useState<string>('J_SION_HOSP');
  const [vehicleType, setVehicleType] = useState<string>('AMBULANCE');
  const [routePlan, setRoutePlan] = useState<RoutePlanResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const fetchJunctions = async () => {
      try {
        const nodes = await api.getRouteNodes();
        setJunctions(nodes);
      } catch (err) {
        console.error("Failed to load junctions:", err);
      }
    };
    fetchJunctions();
  }, []);

  const handleCalculateRoute = async () => {
    if (!startNode || !destNode) return;
    setLoading(true);
    try {
      const res = await api.planRoute({
        start_node_id: startNode,
        destination_node_id: destNode,
        vehicle_type: vehicleType,
        time_minute: currentStepTimeMin
      });
      setRoutePlan(res);
      onRouteCalculated(res);
    } catch (err) {
      console.error("Routing calculation failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const vehicleOptions = [
    { id: 'AMBULANCE', name: 'Ambulance', clearance: '20 cm', icon: Truck, accent: '#68efff' },
    { id: 'FIRE_SERVICE', name: 'Fire Engine', clearance: '45 cm', icon: Truck, accent: '#ff8958' },
    { id: 'POLICE', name: 'Police Patrol', clearance: '25 cm', icon: ShieldCheck, accent: '#7fa8ff' },
    { id: 'PUBLIC_TRANSIT', name: 'Public Bus', clearance: '35 cm', icon: Bus, accent: '#ffd16a' },
    { id: 'COMMUTER', name: 'Commuter Car', clearance: '15 cm', icon: Car, accent: '#50e1b7' },
  ];

  return (
    <div className="h-full bg-[#060b16] p-6 overflow-y-auto font-sans flex flex-col justify-between command-enter">
      <div className="space-y-6 max-w-4xl mx-auto w-full">
        {/* Header */}
        <div>
          <div className="flex items-center space-x-2 text-sky-400">
            <Navigation className="w-5 h-5" />
            <h2 className="font-extrabold text-base tracking-wider uppercase">
              Flood-Aware Emergency Route Optimization
            </h2>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Dynamic hydrodynamic graph pathfinding avoiding streets exceeding vehicle-specific clearance thresholds at forecast lead time <span className="text-sky-400 font-bold">T + {currentStepTimeMin} min</span>.
          </p>
        </div>

        {/* Input Controls Card */}
        <div className="command-panel command-panel-cyan rounded-2xl p-5 space-y-4">
          {/* Vehicle Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
              Select Emergency Vehicle Profile
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {vehicleOptions.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVehicleType(v.id)}
                  aria-pressed={vehicleType === v.id}
                  style={{ '--vehicle-accent': v.accent } as React.CSSProperties}
                  className={`vehicle-profile-card ${vehicleType === v.id ? 'vehicle-profile-selected' : ''}`}
                >
                  <span className="vehicle-card-stage" aria-hidden="true">
                    <span className="vehicle-model-platform" />
                    <span className="vehicle-lane" />
                    <v.icon className="vehicle-model-icon" />
                    <span className="vehicle-beacon" />
                  </span>
                  <span className="vehicle-card-name">{v.name}</span>
                  <span className="vehicle-card-clearance">Max: {v.clearance}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Waypoints Selection */}
          <div className="route-waypoint-console">
            <div className="route-waypoint-stage" aria-hidden="true">
              <div className="route-waypoint-node route-waypoint-origin">
                <span className="route-node-platform" />
                <span className="route-node-orbit" />
                <span className="route-node-core"><MapPin className="w-5 h-5" /></span>
                <span className="route-node-caption">DISPATCH</span>
              </div>
              <div className="route-waypoint-track"><span className="route-waypoint-pulse" /></div>
              <div className="route-waypoint-node route-waypoint-destination">
                <span className="route-node-platform" />
                <span className="route-node-orbit" />
                <span className="route-node-core"><Building2 className="w-5 h-5" /></span>
                <span className="route-node-caption">RESPONSE HUB</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="route-point-field route-point-origin space-y-1.5">
                <label className="route-field-label" htmlFor="route-origin-select">
                  <span className="route-field-icon"><MapPin className="w-4 h-4" /></span>
                  <span className="route-field-title"><span className="route-field-kicker">01 / DEPARTURE</span><span>Origin Dispatch Point</span></span>
                  <span className="route-field-number">A</span>
                </label>
                <select
                  id="route-origin-select"
                  value={startNode}
                  onChange={(e) => setStartNode(e.target.value)}
                  className="route-point-select w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500"
                >
                  {junctions.map((j) => (
                    <option key={j.id} value={j.id}>{j.name} ({j.id})</option>
                  ))}
                </select>
              </div>

              <div className="route-point-field route-point-destination space-y-1.5">
                <label className="route-field-label" htmlFor="route-destination-select">
                  <span className="route-field-icon"><Building2 className="w-4 h-4" /></span>
                  <span className="route-field-title"><span className="route-field-kicker">02 / ARRIVAL</span><span>Emergency Destination Hub</span></span>
                  <span className="route-field-number">B</span>
                </label>
                <select
                  id="route-destination-select"
                  value={destNode}
                  onChange={(e) => setDestNode(e.target.value)}
                  className="route-point-select w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500"
                >
                  {junctions.map((j) => (
                    <option key={j.id} value={j.id}>{j.name} ({j.id})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Calculate Button */}
          <button
            onClick={handleCalculateRoute}
            disabled={loading}
            aria-busy={loading}
            className="route-cta w-full rounded-xl text-white font-extrabold text-xs uppercase tracking-[0.08em] transition-all"
          >
            <span className="route-cta-content">
              <span className="route-cta-icon">
                {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Zap className="w-4 h-4 fill-current" />}
              </span>
              <span className="route-cta-copy">
                <span>{loading ? 'Calculating Flood-Safe Route' : 'Calculate Flood-Safe Route'}</span>
                <small>{loading ? 'CHECKING WATER DEPTH & VEHICLE CLEARANCE' : `DISPATCH ANALYSIS · T+${currentStepTimeMin} MIN`}</small>
              </span>
              {!loading && <ArrowRight className="route-cta-arrow w-4 h-4" />}
            </span>
          </button>
        </div>

        {/* Results Comparison Grid */}
        {routePlan && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Reroute Alert Banner */}
            <div className={`p-4 rounded-xl border font-mono text-xs leading-relaxed flex items-start space-x-3 ${
              routePlan.direct_route_is_flooded
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
            }`}>
              {routePlan.direct_route_is_flooded ? (
                <AlertOctagon className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-bold text-sm mb-1">
                  {routePlan.direct_route_is_flooded ? "HAZARD AVOIDANCE REROUTE ACTIVE" : "STANDARD CORRIDOR PASSABLE"}
                </div>
                <div>{routePlan.reroute_justification}</div>
              </div>
            </div>

            {/* Side-by-Side Cards */}
            <div className="grid grid-cols-2 gap-4">
              {/* Safe Route Card */}
                <div className="command-panel command-panel-teal rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center space-x-1.5 font-bold text-emerald-400 text-xs uppercase font-mono">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Recommended Safe Route</span>
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                    PASSED
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 font-mono text-center pt-2">
                  <div className="metric-card metric-teal bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400">Distance</div>
                    <div className="text-sm font-bold text-white mt-0.5">{(routePlan.safe_route_distance_m / 1000).toFixed(2)} km</div>
                  </div>
                  <div className="metric-card metric-teal bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400">ETA</div>
                    <div className="text-sm font-bold text-emerald-400 mt-0.5">{routePlan.safe_route_eta_min} min</div>
                  </div>
                  <div className="metric-card metric-teal bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400">Max Depth</div>
                    <div className="text-sm font-bold text-emerald-400 mt-0.5">{routePlan.safe_route_max_depth_cm} cm</div>
                  </div>
                </div>

                {/* Segments list */}
                <div className="space-y-1.5 pt-2">
                  <div className="text-[10px] uppercase font-bold text-slate-400 font-mono">Turn-by-Turn Waypoint Sequence</div>
                  {routePlan.safe_route_segments.map((seg, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-slate-900/60 px-2.5 py-1.5 rounded-lg text-xs font-mono border border-slate-800/80">
                      <span className="text-slate-300 truncate max-w-[200px]">{seg.road_name}</span>
                      <span className="text-emerald-400 text-[11px] font-bold">{seg.water_depth_cm} cm</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Direct Route Card */}
              <div className="command-panel rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center space-x-1.5 font-bold text-slate-400 text-xs uppercase font-mono">
                    <Clock className="w-4 h-4" />
                    <span>Direct Shortest Route (Unsafe)</span>
                  </span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    routePlan.direct_route_is_flooded ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {routePlan.direct_route_is_flooded ? 'SUBMERGED' : 'PASSABLE'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 font-mono text-center pt-2">
                  <div className="metric-card metric-info bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400">Distance</div>
                    <div className="text-sm font-bold text-white mt-0.5">{(routePlan.direct_route_distance_m / 1000).toFixed(2)} km</div>
                  </div>
                  <div className="metric-card metric-info bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400">ETA (Normal)</div>
                    <div className="text-sm font-bold text-slate-300 mt-0.5">{routePlan.direct_route_eta_min} min</div>
                  </div>
                  <div className="metric-card metric-danger bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400">Max Depth</div>
                    <div className="text-sm font-bold text-red-400 mt-0.5">{routePlan.direct_route_max_depth_cm} cm</div>
                  </div>
                </div>

                {/* Segments list */}
                <div className="space-y-1.5 pt-2">
                  <div className="text-[10px] uppercase font-bold text-slate-400 font-mono">Direct Path Segments</div>
                  {routePlan.direct_route_segments.map((seg, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-slate-900/60 px-2.5 py-1.5 rounded-lg text-xs font-mono border border-slate-800/80">
                      <span className="text-slate-300 truncate max-w-[200px]">{seg.road_name}</span>
                      <span className={`text-[11px] font-bold ${seg.passable ? 'text-slate-400' : 'text-red-400'}`}>
                        {seg.water_depth_cm} cm {seg.passable ? '' : '⚠️ Submerged'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
