import React, { useEffect, useState } from 'react';
import { 
  Activity, 
  Sliders, 
  X, 
  Play, 
  RotateCcw, 
  CloudRain, 
  Waves, 
  Trash2, 
  Gauge, 
  Zap,
  CheckCircle2,
  Satellite,
  RefreshCw
} from 'lucide-react';
import { api, MosdacStatus } from '../services/api';
import { SimulationResult } from '../types';

interface WhatIfSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
  scenarios: Record<string, any>;
  onSimulationUpdate: (newSim: SimulationResult) => void;
}

export const WhatIfSimulator: React.FC<WhatIfSimulatorProps> = ({
  isOpen,
  onClose,
  scenarios,
  onSimulationUpdate
}) => {
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('cloudburst_emergency_120mm');
  const [rainMultiplier, setRainMultiplier] = useState<number>(1.0);
  const [blockagePct, setBlockagePct] = useState<number>(25.0);
  const [capacityMult, setCapacityMult] = useState<number>(1.0);
  const [tideLevelM, setTideLevelM] = useState<number>(2.4);
  const [horizonMin, setHorizonMin] = useState<number>(180);
  const [loading, setLoading] = useState<boolean>(false);
  const [syncingMosdac, setSyncingMosdac] = useState<boolean>(false);
  const [mosdacMsg, setMosdacMsg] = useState<string | null>(null);
  const [mosdacStatus, setMosdacStatus] = useState<MosdacStatus | null>(null);
  const [lastExecTime, setLastExecTime] = useState<number | null>(null);

  const getApiErrorMessage = (error: any): string => {
    return error?.response?.data?.error || error?.response?.data?.detail || error?.message || 'Unable to reach the flood backend';
  };

  useEffect(() => {
    if (!isOpen) return;
    api.getMosdacStatus().then(setMosdacStatus).catch((error) => {
      setMosdacMsg(`Backend status unavailable: ${getApiErrorMessage(error)}`);
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSyncMosdac = async () => {
    setSyncingMosdac(true);
    setMosdacMsg(null);
    try {
      const result = await api.syncMosdac();
      const refreshedStatus = await api.getMosdacStatus();
      setMosdacStatus(refreshedStatus);
      setMosdacMsg(result.success ? `Synced ${result.data?.filename || 'live granule'}` : `Sync failed: ${result.error || 'MOSDAC returned no data'}`);
      if (result.success) {
        handleScenarioChange('mosdac_live_satellite_dwr');
        setLoading(true);
        const liveSimulation = await api.runSimulation({
          scenario_id: 'mosdac_live_satellite_dwr',
          rainfall_intensity_multiplier: 1.0,
          blockage_percentage: blockagePct,
          conduit_capacity_multiplier: capacityMult,
          tide_level_m: tideLevelM,
          horizon_minutes: horizonMin,
          time_step_min: 10
        });
        setLastExecTime(liveSimulation.metadata.execution_time_ms);
        onSimulationUpdate(liveSimulation);
      }
    } catch (error: any) {
      setMosdacMsg(`Sync error: ${getApiErrorMessage(error)}`);
    } finally {
      setSyncingMosdac(false);
      setLoading(false);
    }
  };

  const handleScenarioChange = (scenId: string) => {
    setSelectedScenarioId(scenId);
    const scen = scenarios[scenId];
    if (scen) {
      setBlockagePct(scen.base_blockage_pct || 20.0);
      setTideLevelM(scen.tide_level_m || 2.4);
      setRainMultiplier(1.0);
    }
  };

  const handleRunSimulation = async () => {
    setLoading(true);
    try {
      const result = await api.runSimulation({
        scenario_id: selectedScenarioId,
        rainfall_intensity_multiplier: rainMultiplier,
        blockage_percentage: blockagePct,
        conduit_capacity_multiplier: capacityMult,
        tide_level_m: tideLevelM,
        horizon_minutes: horizonMin,
        time_step_min: 10
      });
      setLastExecTime(result.metadata.execution_time_ms);
      onSimulationUpdate(result);
    } catch (err) {
      console.error("Simulation failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-[#08101f]/98 backdrop-blur-xl border-l border-cyan-300/15 shadow-2xl p-6 z-40 flex flex-col font-sans overflow-y-auto command-enter">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-2 text-sky-400">
          <Sliders className="w-5 h-5 text-cyan-300" />
          <h2 className="font-extrabold text-sm tracking-wider uppercase">What-If Disaster Studio</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <p className="text-xs text-slate-400 mt-3 font-mono">
        Dynamically adjust hydrologic rainfall intensity, debris blockage, and tidal backwater to stress-test municipal drainage resilience.
      </p>

      <div className="mt-4 command-panel command-panel-cyan p-3 rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Satellite className="w-4 h-4 text-sky-400" />
            <span className="font-bold text-xs text-sky-300">ISRO MOSDAC Radar Ingestion</span>
          </div>
          <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800">READY</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1 font-mono">3RIMG_L2B_HEM HDF5 precipitation</p>
        {mosdacStatus && (
          <div className="mt-2 space-y-1 text-[10px] font-mono text-slate-300">
            <div className="flex justify-between gap-2"><span className="text-slate-500">Backend acquisition</span><span className={mosdacStatus.acquisition_mode === 'LIVE_MOSDAC_CATALOG' ? 'text-emerald-300' : 'text-sky-300'}>{mosdacStatus.acquisition_mode}</span></div>
            <div className="flex justify-between gap-2"><span className="text-slate-500">Observed HDF5 rainfall</span><span className="text-sky-300">{mosdacStatus.max_rain_mmh} mm/hr max</span></div>
            <div className="flex justify-between gap-2"><span className="text-slate-500">Simulation base</span><span className="text-amber-300">{mosdacStatus.simulation_base_rain_mmh ?? '—'} mm/hr</span></div>
            <div className="truncate text-slate-500" title={mosdacStatus.active_file}>Granule: <span className="text-slate-300">{mosdacStatus.active_file}</span></div>
            <div className="text-slate-500">Backend parse status: <span className="text-emerald-300">{mosdacStatus.status}</span></div>
          </div>
        )}
        <button onClick={handleSyncMosdac} disabled={syncingMosdac} className="mt-2.5 w-full py-1.5 px-3 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 hover:text-white border border-sky-400/40 text-xs font-mono flex items-center justify-center space-x-1.5 transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${syncingMosdac ? 'animate-spin' : ''}`} />
          <span>{syncingMosdac ? 'Syncing with MOSDAC...' : 'Fetch Live MOSDAC Radar'}</span>
        </button>
        {mosdacMsg && <p className="text-[10px] text-slate-300 mt-1.5 text-center font-mono">{mosdacMsg}</p>}
      </div>

      {/* Preset Scenarios Selector */}
      <div className="mt-5 space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Observational & Disaster Scenarios</span>
        </label>
        <div className="space-y-1.5">
          {Object.entries(scenarios).map(([id, scen]: [string, any]) => (
            <div
              key={id}
              onClick={() => handleScenarioChange(id)}
              className={`scenario-card p-2.5 rounded-lg border cursor-pointer transition-all ${
                  selectedScenarioId === id
                  ? 'scenario-card-active bg-cyan-400/10 border-cyan-300/50 text-white shadow-[0_0_22px_rgba(0,217,255,0.08)]'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs">{scen.title}</span>
                {selectedScenarioId === id && <CheckCircle2 className="w-4 h-4 text-sky-400" />}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{scen.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Live Sliders */}
      <div className="mt-6 space-y-4">
        {/* Rainfall Multiplier Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-mono">
            <span className="flex items-center space-x-1 text-sky-300">
              <CloudRain className="w-3.5 h-3.5" />
              <span>Rainfall Intensity Scale</span>
            </span>
            <span className="font-bold text-sky-400">{rainMultiplier.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.2"
            max="2.5"
            step="0.1"
            value={rainMultiplier}
            onChange={(e) => setRainMultiplier(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>0.2x (Drizzle)</span>
            <span>1.0x (Baseline)</span>
            <span>2.5x (Deluge)</span>
          </div>
        </div>

        {/* Drainage Blockage Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-mono">
            <span className="flex items-center space-x-1 text-pink-300">
              <Trash2 className="w-3.5 h-3.5" />
              <span>Network Silt / Debris Blockage</span>
            </span>
            <span className="font-bold text-pink-400">{blockagePct.toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="80"
            step="5"
            value={blockagePct}
            onChange={(e) => setBlockagePct(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>0% (Clean Drains)</span>
            <span>40% (Moderate Silt)</span>
            <span>80% (Severe Choke)</span>
          </div>
        </div>

        {/* Conduit Hydraulic Capacity Multiplier */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-mono">
            <span className="flex items-center space-x-1 text-teal-300">
              <Gauge className="w-3.5 h-3.5" />
              <span>Conduit Hydraulic Capacity</span>
            </span>
            <span className="font-bold text-teal-400">{capacityMult.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={capacityMult}
            onChange={(e) => setCapacityMult(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-400"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>0.5x (Constricted)</span>
            <span>1.0x (Standard RCC)</span>
            <span>2.0x (Upgraded Box)</span>
          </div>
        </div>

        {/* Tidal Level Outfall Head */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-mono">
            <span className="flex items-center space-x-1 text-indigo-300">
              <Waves className="w-3.5 h-3.5" />
              <span>Mithi Outfall High-Tide Head</span>
            </span>
            <span className="font-bold text-indigo-400">{tideLevelM.toFixed(1)} m</span>
          </div>
          <input
            type="range"
            min="1.0"
            max="4.0"
            step="0.2"
            value={tideLevelM}
            onChange={(e) => setTideLevelM(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-400"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>1.0m (Low Tide)</span>
            <span>2.4m (Mean Tide)</span>
            <span>4.0m (Spring Surge)</span>
          </div>
        </div>
      </div>

      {/* Execution Benchmark Feedback */}
      {lastExecTime !== null && (
          <div className="mt-4 p-2.5 rounded-lg bg-teal-400/10 border border-teal-300/30 text-teal-200 font-mono text-[11px] flex items-center justify-between">
          <span>Digital Twin Solved:</span>
          <span className="font-bold">{lastExecTime} ms</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-6 pt-4 border-t border-slate-800 space-y-2">
        <button
          onClick={handleRunSimulation}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-cyan-400/20 transition-all flex items-center justify-center space-x-2"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Execute What-If Nowcast</span>
            </>
          )}
        </button>

        <button
          onClick={() => {
            setRainMultiplier(1.0);
            setBlockagePct(20.0);
            setCapacityMult(1.0);
            setTideLevelM(2.4);
          }}
          className="w-full py-2 rounded-lg bg-slate-950/70 border border-white/[0.07] hover:border-cyan-300/25 text-slate-300 text-xs font-mono transition-colors flex items-center justify-center space-x-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Default Hydrology</span>
        </button>
      </div>
    </div>
  );
};
