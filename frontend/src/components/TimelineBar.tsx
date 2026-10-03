import React from 'react';
import { CloudRain } from 'lucide-react';
import { SimulationResult, TimelineStep } from '../types';

interface TimelineBarProps {
  simulation: SimulationResult | null;
  currentStepIndex: number;
  setCurrentStepIndex: React.Dispatch<React.SetStateAction<number>>;
}

export const TimelineBar: React.FC<TimelineBarProps> = ({
  simulation,
  currentStepIndex,
  setCurrentStepIndex
}) => {
  const timeline = simulation?.timeline || [];
  const currentStep: TimelineStep | undefined = timeline[currentStepIndex];

  if (!simulation || timeline.length === 0) return null;

  return (
    <div className="timeline-dock h-[102px] bg-[#08101f]/95 backdrop-blur-xl border-t border-cyan-400/10 px-6 flex items-center justify-between z-20 command-enter">
      <div className="timeline-progress" style={{ '--timeline-progress': `${(currentStepIndex / Math.max(1, timeline.length - 1)) * 100}%` } as React.CSSProperties} />
      {/* Main Scrubber Slider */}
      <div className="flex-1 max-w-5xl mx-auto">
        <div className="flex justify-between items-center text-xs font-mono mb-1.5">
          <div className="flex items-center space-x-2">
              <span className="text-cyan-300 font-bold text-sm tracking-wide">
              T + {currentStep?.time_minute || 0} min
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">
              Lead Time: {((currentStep?.time_minute || 0) / 60).toFixed(1)} hrs ahead
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1 text-cyan-300">
              <CloudRain className="w-3.5 h-3.5" />
              <span>Rainfall: {currentStep?.current_rainfall_peak_mmh || 0} mm/hr</span>
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-500">FORECAST WINDOW 0–180 MIN</span>
          </div>
        </div>

        {/* Range Track */}
        <div className="timeline-rail">
          <div className="timeline-fill" style={{ width: `${(currentStepIndex / Math.max(1, timeline.length - 1)) * 100}%` }} />
          {timeline.map((step, idx) => <span key={`marker-${step.time_minute}`} className={`timeline-marker ${idx === currentStepIndex ? 'timeline-marker-active' : ''}`} style={{ left: `${(idx / Math.max(1, timeline.length - 1)) * 100}%` }} />)}
          <input type="range" min={0} max={timeline.length - 1} value={currentStepIndex} onChange={(e) => setCurrentStepIndex(Number(e.target.value))} aria-label="Forecast timeline" />
        </div>

        {/* Step Ticks */}
        <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1 px-1">
          {timeline.map((step, idx) => (
            <span
              key={step.time_minute}
              onClick={() => setCurrentStepIndex(idx)}
              className={`timeline-tick ${
                idx === currentStepIndex ? 'timeline-tick-active font-bold' : ''
              }`}
            >
              {step.time_minute}m
            </span>
          ))}
        </div>
      </div>

    </div>
  );
};
