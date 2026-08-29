import React from 'react';
import { 
  CloudRain, 
  ShieldAlert, 
  Activity, 
  Layers, 
  Database, 
  Navigation, 
  Info,
  Clock,
  Gauge
} from 'lucide-react';
import { SimulationResult } from '../types';

interface NavbarProps {
  simulation: SimulationResult | null;
  activeTab: 'map' | 'twin' | 'routing' | 'provenance';
  setActiveTab: (tab: 'map' | 'twin' | 'routing' | 'provenance') => void;
  onOpenWhatIf: () => void;
  isWhatIfOpen: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  simulation,
  activeTab,
  setActiveTab,
  onOpenWhatIf,
  isWhatIfOpen
}) => {
  return (
    <header className="h-16 bg-[#0f172a] border-b border-slate-800 px-4 flex items-center justify-between select-none z-30">
      {/* Brand & Identity */}
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
          <CloudRain className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-base tracking-wider bg-gradient-to-r from-sky-400 via-teal-300 to-indigo-300 bg-clip-text text-transparent">
              URBAN FLOOD NOWCASTING
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800/60">
              SIH 26085
            </span>
          </div>
          <p className="text-[11px] text-slate-400 flex items-center space-x-1 font-mono">
            <span>MoES / NCMRWF</span>
            <span>•</span>
            <span className="text-teal-400">0–3h Drainage-Coupled Digital Twin</span>
            <span>•</span>
            <span className="text-slate-500">Mumbai Kurla-BKC Corridor</span>
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center bg-slate-900/80 p-1 rounded-lg border border-slate-800">
        <button
          onClick={() => setActiveTab('map')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            activeTab === 'map'
              ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>GIS Command Map</span>
        </button>

        <button
          onClick={() => setActiveTab('twin')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            activeTab === 'twin'
              ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Drainage Digital Twin</span>
        </button>

        <button
          onClick={() => setActiveTab('routing')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            activeTab === 'routing'
              ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Navigation className="w-4 h-4" />
          <span>Emergency Routing</span>
        </button>

        <button
          onClick={() => setActiveTab('provenance')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            activeTab === 'provenance'
              ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Data Provenance</span>
        </button>
      </div>

      {/* Quick Action Simulator Trigger & Metrics */}
      <div className="flex items-center space-x-3">
        {simulation && (
          <div className="hidden lg:flex items-center space-x-3 bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300">
            <div className="flex items-center space-x-1 text-emerald-400">
              <Gauge className="w-3.5 h-3.5" />
              <span>{simulation.metadata.execution_time_ms} ms</span>
            </div>
            <div className="w-px h-3.5 bg-slate-700" />
            <div className="flex items-center space-x-1 text-amber-400" title="Maximum basin-wide street flood depth across all roads and all 0-3h timesteps (includes low-elevation pooling factor)">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Max Basin Depth (0–3h): {simulation.peak_summary.max_depth_cm} cm</span>
            </div>
          </div>
        )}

        <button
          onClick={onOpenWhatIf}
          className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
            isWhatIfOpen
              ? 'bg-amber-500/20 border-amber-500 text-amber-300'
              : 'bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white border-sky-400/40 shadow-md shadow-sky-600/30'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>What-If Simulator</span>
        </button>
      </div>
    </header>
  );
};
