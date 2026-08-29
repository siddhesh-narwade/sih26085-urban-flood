import React, { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { TimelineBar } from './components/TimelineBar';
import { MapView } from './components/MapView';
import { WhatIfSimulator } from './components/WhatIfSimulator';
import { ExplainabilityModal } from './components/ExplainabilityModal';
import { RoutingPanel } from './components/RoutingPanel';
import { DrainageTwinView } from './components/DrainageTwinView';
import { ProvenanceModal } from './components/ProvenanceModal';
import { AlertsFeed } from './components/AlertsFeed';
import { api } from './services/api';
import { SimulationResult, RoutePlanResponse, TimelineStep } from './types';
import { 
  AlertTriangle, 
  CloudRain, 
  Droplets, 
  ShieldAlert, 
  Activity, 
  Compass, 
  HelpCircle,
  TrendingUp,
  MapPin
} from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'map' | 'twin' | 'routing' | 'provenance'>('map');
  const [isWhatIfOpen, setIsWhatIfOpen] = useState<boolean>(false);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [scenarios, setScenarios] = useState<Record<string, any>>({});
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(4); // Default to t=40 min (peak)
  const [selectedRoadId, setSelectedRoadId] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RoutePlanResponse | null>(null);

  // Geospatial layers
  const [roadsGeoJSON, setRoadsGeoJSON] = useState<any>(null);
  const [drainageNodesGeoJSON, setDrainageNodesGeoJSON] = useState<any>(null);
  const [drainageEdgesGeoJSON, setDrainageEdgesGeoJSON] = useState<any>(null);
  const [poisGeoJSON, setPoisGeoJSON] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Initial Data Load
  useEffect(() => {
    const initData = async () => {
      try {
        const [roads, nodes, edges, pois, scens, sim] = await Promise.all([
          api.getRoads(),
          api.getDrainageNodes(),
          api.getDrainageEdges(),
          api.getPOIs(),
          api.getScenarios(),
          api.getCurrentSimulation()
        ]);

        setRoadsGeoJSON(roads);
        setDrainageNodesGeoJSON(nodes);
        setDrainageEdgesGeoJSON(edges);
        setPoisGeoJSON(pois);
        setScenarios(scens);
        setSimulation(sim);
      } catch (err) {
        console.error("Initialization failed:", err);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  const currentStep: TimelineStep | undefined = simulation?.timeline[currentStepIndex];
  const roadStats = currentStep ? Object.values(currentStep.roads || {}) : [];
  // Sort roads by water depth descending
  const sortedRoads = [...roadStats].sort((a, b) => b.water_depth_cm - a.water_depth_cm);

  const highestRiskRoads = sortedRoads.filter((r) => r.water_depth_cm > 5.0);
  const surchargedNodesCount = currentStep
    ? Object.values(currentStep.drainage_nodes || {}).filter((n) => n.is_surcharged).length
    : 0;

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0a0f1d] text-slate-100 overflow-hidden select-none">
      {/* Top Command Center Header */}
      <Navbar
        simulation={simulation}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenWhatIf={() => setIsWhatIfOpen(!isWhatIfOpen)}
        isWhatIfOpen={isWhatIfOpen}
      />

      {/* Main Content Area */}
      <main className="flex-1 relative flex overflow-hidden">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-3">
            <div className="w-10 h-10 border-3 border-sky-400 border-t-transparent rounded-full animate-spin" />
            <p className="font-mono text-xs text-sky-400">Loading Municipal Hydrodynamic Digital Twin...</p>
          </div>
        ) : (
          <>
            {/* ==== GIS Map is ALWAYS mounted, hidden with CSS when not on map tab ==== */}
            {/* This preserves the Leaflet instance + all layer groups across tab switches */}
            <div
              className="flex-1 flex w-full h-full relative"
              style={{ display: activeTab === 'map' ? 'flex' : 'none' }}
            >
              {/* GIS Map Canvas */}
              <div className="flex-1 h-full relative">
                <MapView
                  roadsGeoJSON={roadsGeoJSON}
                  drainageNodesGeoJSON={drainageNodesGeoJSON}
                  drainageEdgesGeoJSON={drainageEdgesGeoJSON}
                  poisGeoJSON={poisGeoJSON}
                  simulation={simulation}
                  currentStepIndex={currentStepIndex}
                  selectedRoute={selectedRoute}
                  onSelectRoad={(rId) => setSelectedRoadId(rId)}
                  onSelectDrainageNode={(nId) => {
                    const attachedRoad = sortedRoads.find((r) => r.road_id.includes(nId));
                    if (attachedRoad) setSelectedRoadId(attachedRoad.road_id);
                  }}
                />
              </div>

              {/* Right Operational Sidebar */}
              <aside className="w-96 h-full bg-[#0f172a]/95 backdrop-blur-md border-l border-slate-800 flex flex-col p-4 space-y-4 overflow-y-auto z-10 font-sans">
                {/* Active Scenario Overview */}
                <div className="bg-[#111827] border border-slate-800 p-4 rounded-2xl shadow-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">
                      Active Scenario
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold">
                      NOWCAST T+{currentStep?.time_minute || 0}m
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-white">
                    {simulation?.metadata.scenario_title}
                  </h3>
                  {/* Multiplier badge — only show when not 1.0 */}
                  {simulation?.metadata.rainfall_intensity_multiplier !== undefined &&
                    simulation.metadata.rainfall_intensity_multiplier !== 1.0 && (
                    <div className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-0.5">
                      Rainfall Multiplier: ×{simulation.metadata.rainfall_intensity_multiplier.toFixed(1)} applied
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                    <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                      <div className="text-[10px] text-slate-400">Base Scenario Rate</div>
                      <div className="font-bold text-slate-300 mt-0.5">
                        {simulation?.metadata.scenario_base_intensity_mmh ?? '—'} mm/hr
                      </div>
                    </div>
                    <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                      <div className="text-[10px] text-slate-400">Storm Core @ T+{currentStep?.time_minute || 0}m</div>
                      <div className="font-bold text-sky-400 mt-0.5">
                        {currentStep?.current_rainfall_peak_mmh || 0} mm/hr
                      </div>
                    </div>
                    <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                      <div className="text-[10px] text-slate-400">Applied Peak (×mult)</div>
                      <div className="font-bold text-indigo-400 mt-0.5">
                        {simulation?.metadata.applied_peak_intensity_mmh ?? currentStep?.current_rainfall_peak_mmh ?? '—'} mm/hr
                      </div>
                    </div>
                    <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                      <div className="text-[10px] text-slate-400">Drainage Surcharge</div>
                      <div className={`font-bold mt-0.5 ${surchargedNodesCount > 0 ? 'text-pink-400' : 'text-emerald-400'}`}>
                        {surchargedNodesCount} Node{surchargedNodesCount === 1 ? '' : 's'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Street Inundation Depth Table */}
                <div className="bg-[#111827] border border-slate-800 p-4 rounded-2xl shadow-xl space-y-3 flex-1 flex flex-col min-h-[220px]">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-300 font-mono flex items-center space-x-1.5">
                      <Droplets className="w-3.5 h-3.5 text-sky-400" />
                      <span>High-Risk Street Segments</span>
                    </h4>
                    <span className="text-[10px] font-mono text-slate-400">
                      {highestRiskRoads.length} Flooded
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                    {sortedRoads.map((road) => (
                      <div
                        key={road.road_id}
                        onClick={() => setSelectedRoadId(road.road_id)}
                        className="p-2.5 rounded-xl bg-slate-900/70 hover:bg-slate-800/80 border border-slate-800/80 cursor-pointer transition-all flex items-center justify-between group"
                      >
                        <div className="space-y-0.5">
                          <div className="text-xs font-semibold text-slate-200 group-hover:text-sky-300 transition-colors truncate max-w-[170px]">
                            {road.name}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500">
                            Peak: {road.peak_depth_cm}cm @ T+{road.time_to_peak_min}m
                          </div>
                        </div>

                        <div className="text-right">
                          <div className={`text-xs font-mono font-bold ${
                            road.water_depth_cm > 30 ? 'text-red-400' :
                            road.water_depth_cm > 15 ? 'text-orange-400' :
                            road.water_depth_cm > 5 ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                            {road.water_depth_cm} cm
                          </div>
                          <div className="text-[9px] font-mono uppercase text-slate-400">
                            {road.risk_level}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Incident Feed */}
                <div className="h-44">
                  <AlertsFeed
                    simulation={simulation}
                    currentStepIndex={currentStepIndex}
                  />
                </div>
              </aside>
            </div>

            {/* View 2: Technical Drainage Digital Twin */}
            {activeTab === 'twin' && (
              <div className="flex-1 h-full">
                <DrainageTwinView
                  simulation={simulation}
                  currentStepIndex={currentStepIndex}
                />
              </div>
            )}

            {/* View 3: Emergency Safe Routing — split view with map mini-preview + routing panel */}
            {activeTab === 'routing' && (
              <div className="flex-1 h-full flex">
                {/* Left: Route Results panel */}
                <div className="flex-1 h-full overflow-hidden">
                  <RoutingPanel
                    currentStepTimeMin={currentStep?.time_minute || 40}
                    onRouteCalculated={(plan) => {
                      setSelectedRoute(plan);
                      // Switch to map tab so the polyline overlay renders on the live Leaflet instance
                      if (plan) setActiveTab('map');
                    }}
                  />
                </div>
              </div>
            )}

            {/* View 4: Scientific Data Provenance */}
            {activeTab === 'provenance' && (
              <div className="flex-1 h-full">
                <ProvenanceModal />
              </div>
            )}
          </>
        )}
      </main>

      {/* Bottom 0-3h Nowcasting Scrubber Timeline */}
      <TimelineBar
        simulation={simulation}
        currentStepIndex={currentStepIndex}
        setCurrentStepIndex={setCurrentStepIndex}
      />

      {/* What-If Simulation Studio Drawer */}
      <WhatIfSimulator
        isOpen={isWhatIfOpen}
        onClose={() => setIsWhatIfOpen(false)}
        scenarios={scenarios}
        onSimulationUpdate={(newSim) => {
          setSimulation(newSim);
        }}
      />

      {/* "Why is this area flooding?" Explainability Modal */}
      <ExplainabilityModal
        selectedRoadId={selectedRoadId}
        currentStepTimeMin={currentStep?.time_minute || 40}
        onClose={() => setSelectedRoadId(null)}
      />
    </div>
  );
};
