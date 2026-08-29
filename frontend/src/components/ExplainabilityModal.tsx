import React, { useEffect, useState } from 'react';
import { 
  HelpCircle, 
  X, 
  TrendingUp, 
  AlertTriangle, 
  Droplets, 
  Waves, 
  Compass, 
  Activity,
  CheckCircle2
} from 'lucide-react';
import { api } from '../services/api';
import { FloodExplainResponse } from '../types';

interface ExplainabilityModalProps {
  selectedRoadId: string | null;
  currentStepTimeMin: number;
  onClose: () => void;
}

export const ExplainabilityModal: React.FC<ExplainabilityModalProps> = ({
  selectedRoadId,
  currentStepTimeMin,
  onClose
}) => {
  const [explanation, setExplanation] = useState<FloodExplainResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!selectedRoadId) {
      setExplanation(null);
      return;
    }

    const fetchExplanation = async () => {
      setLoading(true);
      try {
        const data = await api.explainFlooding(selectedRoadId, currentStepTimeMin);
        setExplanation(data);
      } catch (err) {
        console.error("Failed to fetch explanation:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchExplanation();
  }, [selectedRoadId, currentStepTimeMin]);

  if (!selectedRoadId) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sky-400">
            <HelpCircle className="w-5 h-5" />
            <h3 className="font-extrabold text-sm tracking-wider uppercase">
              Explainable AI & Hydrology Diagnostics
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading || !explanation ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-3 border-sky-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-mono text-slate-400">Analyzing multi-factor hydrodynamic causality...</p>
          </div>
        ) : (
          <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto font-sans">
            {/* Title & Key Metrics Banner */}
            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-bold text-white">{explanation.target_name}</h4>
                <span className={`px-2.5 py-1 rounded-md text-xs font-extrabold uppercase font-mono ${
                  explanation.risk_level === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border border-red-500/40' :
                  explanation.risk_level === 'HIGH' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' :
                  explanation.risk_level === 'MODERATE' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                  'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                }`}>
                  {explanation.risk_level} RISK
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-1">
                Diagnostic evaluated at forecast timestamp: <span className="text-sky-400 font-bold">T + {explanation.time_minute} min</span>
              </p>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-4 gap-3 font-mono text-center">
              <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
                <div className="text-[10px] uppercase text-slate-400">Current Depth</div>
                <div className="text-lg font-bold text-sky-400 mt-0.5">{explanation.water_depth_cm} cm</div>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
                <div className="text-[10px] uppercase text-slate-400">Peak Forecast</div>
                <div className="text-lg font-bold text-amber-400 mt-0.5">{explanation.peak_depth_cm} cm</div>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
                <div className="text-[10px] uppercase text-slate-400">Time to Peak</div>
                <div className="text-lg font-bold text-purple-400 mt-0.5">{explanation.time_to_peak_min} min</div>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
                <div className="text-[10px] uppercase text-slate-400">Base Elev</div>
                <div className="text-lg font-bold text-teal-400 mt-0.5">{explanation.drainage_status.base_elev_m} m</div>
              </div>
            </div>

            {/* Why Is This Area Flooding? Causal Percentage Decomposition */}
            <div className="space-y-3">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5 font-mono">
                <TrendingUp className="w-4 h-4 text-sky-400" />
                <span>Primary Flooding Causal Drivers</span>
              </h5>

              <div className="space-y-3 bg-slate-900/60 border border-slate-800/80 p-4 rounded-xl">
                {explanation.factors.map((factor, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-200">{factor.factor_name}</span>
                      <span className="font-mono font-bold text-sky-400">{factor.percentage}%</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          factor.severity === 'CRITICAL' ? 'bg-pink-500' :
                          factor.severity === 'HIGH' ? 'bg-red-400' :
                          factor.severity === 'MODERATE' ? 'bg-amber-400' : 'bg-sky-400'
                        }`}
                        style={{ width: `${factor.percentage}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400">{factor.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Scientific Summary Statement */}
            <div className="p-4 rounded-xl bg-sky-950/30 border border-sky-800/50 text-xs font-mono text-sky-200 leading-relaxed">
              <div className="font-bold text-sky-400 uppercase text-[10px] mb-1 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Hydraulic Decision Support Summary</span>
              </div>
              {explanation.scientific_summary}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
