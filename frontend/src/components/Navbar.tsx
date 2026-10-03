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
  Gauge,
  RadioTower
  , BarChart3
} from 'lucide-react';
import { SimulationResult } from '../types';
import { StatusPill, TelemetryChip } from './ui';

interface NavbarProps {
  simulation: SimulationResult | null;
  activeTab: 'map' | 'twin' | 'routing' | 'provenance' | 'analytics';
  setActiveTab: (tab: 'map' | 'twin' | 'routing' | 'provenance' | 'analytics') => void;
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
    <header className="h-[76px] bg-[#08101f]/95 border-b border-cyan-400/10 px-5 flex items-center justify-between select-none z-30 backdrop-blur-xl command-enter">
      {/* Brand & Identity */}
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-400/10 border border-cyan-300/30 flex items-center justify-center text-cyan-300">
          <CloudRain className="w-5 h-5 command-pulse" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-[15px] tracking-[0.12em] text-slate-100">
              URBAN FLOOD NOWCASTING
            </span>
            <span className="text-[9px] uppercase font-bold tracking-[0.16em] px-2 py-1 rounded-md bg-cyan-400/10 text-cyan-300 border border-cyan-300/20">
              SIH 26085
            </span>
          </div>
          <p className="text-[10px] text-slate-400 flex items-center space-x-1 font-mono mt-1">
            <span>MoES / NCMRWF</span>
            <span>•</span>
            <span className="text-teal-400">0–3h Drainage-Coupled Digital Twin</span>
            <span>•</span>
            <span className="text-slate-500">Mumbai Kurla-BKC Corridor</span>
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="command-nav flex items-center bg-slate-950/60 p-1 rounded-xl border border-white/[0.07]">
        <button data-tab="map"
          onClick={() => setActiveTab('map')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            activeTab === 'map'
              ? 'bg-cyan-400/10 text-cyan-200 shadow-[inset_0_-2px_0_var(--cyan)]'
                : 'text-slate-400 hover:text-cyan-100 hover:bg-cyan-400/5'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>GIS Command Map</span>
        </button>

        <button data-tab="twin"
          onClick={() => setActiveTab('twin')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            activeTab === 'twin'
              ? 'bg-cyan-400/10 text-cyan-200 shadow-[inset_0_-2px_0_var(--cyan)]'
                : 'text-slate-400 hover:text-cyan-100 hover:bg-cyan-400/5'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Drainage Digital Twin</span>
        </button>

        <button data-tab="routing"
          onClick={() => setActiveTab('routing')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            activeTab === 'routing'
              ? 'bg-cyan-400/10 text-cyan-200 shadow-[inset_0_-2px_0_var(--cyan)]'
                : 'text-slate-400 hover:text-cyan-100 hover:bg-cyan-400/5'
          }`}
        >
          <Navigation className="w-4 h-4" />
          <span>Emergency Routing</span>
        </button>

        <button data-tab="provenance"
          onClick={() => setActiveTab('provenance')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            activeTab === 'provenance'
              ? 'bg-cyan-400/10 text-cyan-200 shadow-[inset_0_-2px_0_var(--cyan)]'
                : 'text-slate-400 hover:text-cyan-100 hover:bg-cyan-400/5'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Data Provenance</span>
        </button>

        <button data-tab="analytics"
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            activeTab === 'analytics'
              ? 'bg-cyan-400/10 text-cyan-200 shadow-[inset_0_-2px_0_var(--cyan)]'
              : 'text-slate-400 hover:text-cyan-100 hover:bg-cyan-400/5'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Analytics</span>
        </button>
      </div>

      {/* Quick Action Simulator Trigger & Metrics */}
      <div className="flex items-center space-x-3">
        {simulation && (
          <div className="hidden xl:flex items-center gap-2 bg-slate-950/50 border border-white/[0.07] px-2 py-2 rounded-xl">
            <TelemetryChip label="System latency" value={`${simulation.metadata.execution_time_ms} ms`} tone="teal" />
            <TelemetryChip label="Max basin depth" value={`${simulation.peak_summary.max_depth_cm} cm`} tone="amber" />
            <StatusPill label="Engine online" tone="live" />
          </div>
        )}

        <button
          onClick={onOpenWhatIf}
          className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
            isWhatIfOpen
              ? 'bg-amber-400/10 border-amber-300/50 text-amber-200'
              : 'bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-100 border-cyan-300/30 shadow-[0_0_22px_rgba(0,217,255,0.08)]'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>What-If Simulator</span>
        </button>
      </div>
    </header>
  );
};
