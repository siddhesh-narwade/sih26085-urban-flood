import React from 'react';
import { ShieldAlert, AlertTriangle, Info, Bell } from 'lucide-react';
import { SimulationResult, TimelineStep } from '../types';

interface AlertsFeedProps {
  simulation: SimulationResult | null;
  currentStepIndex: number;
}

export const AlertsFeed: React.FC<AlertsFeedProps> = ({
  simulation,
  currentStepIndex
}) => {
  const currentStep: TimelineStep | undefined = simulation?.timeline[currentStepIndex];
  const allAlerts = simulation?.alerts || [];

  // Filter alerts relevant up to current step
  const relevantAlerts = allAlerts.filter(
    (a) => a.time_min <= (currentStep?.time_minute || 0)
  );

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col h-full font-sans">
      <div className="flex items-center space-x-2 text-amber-400 pb-3 border-b border-slate-800">
        <Bell className="w-4 h-4" />
        <h3 className="font-bold text-xs uppercase tracking-wider font-mono">
          Incident Feed & Flash Warnings ({relevantAlerts.length})
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 mt-3 pr-1 font-mono text-xs">
        {relevantAlerts.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-[11px]">
            No critical flood alerts triggered at T={currentStep?.time_minute || 0}m.
          </div>
        ) : (
          relevantAlerts.map((alert, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 space-y-1 animate-in fade-in"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-[11px] text-red-400 flex items-center space-x-1">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span>{alert.severity} • T+{alert.time_min}m</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-200 leading-snug">{alert.message}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
