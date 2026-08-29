import React, { useEffect, useState } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  CloudRain,
  Flame
} from 'lucide-react';
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
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  const timeline = simulation?.timeline || [];
  const currentStep: TimelineStep | undefined = timeline[currentStepIndex];

  // Auto-play timer
  useEffect(() => {
    let interval: any = null;
    if (isPlaying && timeline.length > 0) {
      const delay = Math.max(200, 1000 / playbackSpeed);
      interval = setInterval(() => {
        setCurrentStepIndex((prev: number) => {
          if (prev >= timeline.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, delay);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, timeline.length, setCurrentStepIndex]);

  if (!simulation || timeline.length === 0) return null;

  return (
    <div className="h-20 bg-[#0f172a]/95 backdrop-blur-md border-t border-slate-800 px-6 flex items-center justify-between z-20">
      {/* Player Controls */}
      <div className="flex items-center space-x-3">
        <button
          onClick={() => {
            setIsPlaying(false);
            setCurrentStepIndex(0);
          }}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          title="Reset to T=0"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          onClick={() => setCurrentStepIndex((prev) => Math.max(0, prev - 1))}
          disabled={currentStepIndex === 0}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 transition-colors"
          title="Step Backward (10 min)"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="p-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold shadow-lg shadow-sky-500/30 transition-all transform active:scale-95"
          title={isPlaying ? "Pause Nowcast" : "Play 0-3h Nowcast"}
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
        </button>

        <button
          onClick={() => setCurrentStepIndex((prev) => Math.min(timeline.length - 1, prev + 1))}
          disabled={currentStepIndex === timeline.length - 1}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 transition-colors"
          title="Step Forward (10 min)"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Speed Selector */}
        <div className="flex items-center bg-slate-800/80 rounded-lg p-0.5 border border-slate-700 text-[11px] font-mono">
          {[1, 2, 5].map((speed) => (
            <button
              key={speed}
              onClick={() => setPlaybackSpeed(speed)}
              className={`px-2 py-1 rounded ${
                playbackSpeed === speed
                  ? 'bg-sky-500 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>

      {/* Main Scrubber Slider */}
      <div className="flex-1 max-w-3xl mx-8">
        <div className="flex justify-between items-center text-xs font-mono mb-1.5">
          <div className="flex items-center space-x-2">
            <span className="text-sky-400 font-bold text-sm">
              T + {currentStep?.time_minute || 0} min
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">
              Lead Time: {((currentStep?.time_minute || 0) / 60).toFixed(1)} hrs ahead
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1 text-sky-400">
              <CloudRain className="w-3.5 h-3.5" />
              <span>Rainfall: {currentStep?.current_rainfall_peak_mmh || 0} mm/hr</span>
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">Horizon: 180 min (0-3 Hours)</span>
          </div>
        </div>

        {/* Range Track */}
        <div className="relative flex items-center">
          <input
            type="range"
            min={0}
            max={timeline.length - 1}
            value={currentStepIndex}
            onChange={(e) => setCurrentStepIndex(Number(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400 focus:outline-none"
          />
        </div>

        {/* Step Ticks */}
        <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1 px-1">
          {timeline.map((step, idx) => (
            <span
              key={step.time_minute}
              onClick={() => setCurrentStepIndex(idx)}
              className={`cursor-pointer hover:text-sky-400 ${
                idx === currentStepIndex ? 'text-sky-400 font-bold underline' : ''
              }`}
            >
              {step.time_minute}m
            </span>
          ))}
        </div>
      </div>

      {/* Current Step Severity Badge */}
      <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl">
        <Clock className="w-4 h-4 text-sky-400" />
        <div>
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            Forecast Step
          </div>
          <div className="text-xs font-mono font-bold text-slate-200">
            Step {currentStepIndex + 1} of {timeline.length}
          </div>
        </div>
      </div>
    </div>
  );
};
