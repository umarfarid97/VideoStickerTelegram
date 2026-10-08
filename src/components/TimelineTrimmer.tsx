import React from 'react';
import { Scissors, Zap } from 'lucide-react';

interface TimelineTrimmerProps {
  duration: number;
  startTime: number;
  endTime: number;
  onRangeChange: (start: number, end: number) => void;
  onScrub: (time: number) => void;
  isGif: boolean;
  speedUpToFit: boolean;
  onToggleSpeedUp: (val: boolean) => void;
}

export const TimelineTrimmer: React.FC<TimelineTrimmerProps> = ({
  duration,
  startTime,
  endTime,
  onRangeChange,
  onScrub,
  isGif,
  speedUpToFit,
  onToggleSpeedUp,
}) => {
  const selectedDuration = Math.max(0.1, endTime - startTime);
  const isCappedAt3 = selectedDuration >= 3.0;

  const handleStartChange = (val: number) => {
    const newStart = Math.max(0, Math.min(val, duration - 0.1));
    let newEnd = endTime;

    // Enforce max 3.0s duration rule for Telegram
    if (newEnd - newStart > 3.0) {
      newEnd = Math.min(duration, newStart + 3.0);
    } else if (newEnd <= newStart) {
      newEnd = Math.min(duration, newStart + 0.5);
    }

    onRangeChange(newStart, newEnd);
    onScrub(newStart);
  };

  const handleEndChange = (val: number) => {
    const newEnd = Math.min(duration, Math.max(val, 0.2));
    let newStart = startTime;

    // Enforce max 3.0s duration rule for Telegram
    if (newEnd - newStart > 3.0) {
      newStart = Math.max(0, newEnd - 3.0);
    } else if (newStart >= newEnd) {
      newStart = Math.max(0, newEnd - 0.5);
    }

    onRangeChange(newStart, newEnd);
    onScrub(newEnd);
  };

  // Quick preset shortcuts
  const selectFirst3s = () => {
    const newEnd = Math.min(duration, 3.0);
    onRangeChange(0, newEnd);
    onScrub(0);
  };

  const selectMiddle3s = () => {
    if (duration <= 3.0) {
      onRangeChange(0, duration);
      onScrub(0);
      return;
    }
    const mid = duration / 2;
    const newStart = Math.max(0, mid - 1.5);
    const newEnd = Math.min(duration, newStart + 3.0);
    onRangeChange(newStart, newEnd);
    onScrub(newStart);
  };

  const selectLast3s = () => {
    const newStart = Math.max(0, duration - 3.0);
    onRangeChange(newStart, duration);
    onScrub(newStart);
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scissors className="w-4 h-4 text-sky-400" />
          <h3 className="text-sm font-semibold text-white m-0">Timeline Trimmer & Selection</h3>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-medium border ${
              selectedDuration <= 3.0
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}
          >
            Selection: {selectedDuration.toFixed(2)}s / max 3.0s
          </span>
        </div>
      </div>

      {/* Visual Timeline Bar */}
      <div className="relative h-12 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center px-3 shadow-inner">
        {/* Background track ticks */}
        <div className="absolute inset-0 flex justify-between px-3 pointer-events-none opacity-20">
          {[0, 25, 50, 75, 100].map((tick) => (
            <div key={tick} className="h-full w-px bg-slate-400" />
          ))}
        </div>

        {/* Selected Highlight Window */}
        <div
          className="absolute top-0 bottom-0 bg-sky-500/20 border-x-2 border-sky-400 transition-all pointer-events-none"
          style={{
            left: `${(startTime / Math.max(0.1, duration)) * 100}%`,
            width: `${(selectedDuration / Math.max(0.1, duration)) * 100}%`,
          }}
        >
          <div className="absolute top-1 left-2 text-[10px] font-mono text-sky-300 font-bold">
            {selectedDuration.toFixed(2)}s
          </div>
        </div>

        <div className="relative z-10 w-full flex items-center justify-between text-[11px] font-mono text-slate-400 select-none">
          <span>0.0s</span>
          <span className="text-sky-300 font-semibold bg-slate-900/90 px-2 py-0.5 rounded border border-slate-700/80">
            {startTime.toFixed(2)}s → {endTime.toFixed(2)}s
          </span>
          <span>{duration.toFixed(1)}s</span>
        </div>
      </div>

      {/* Dual Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div>
          <div className="flex justify-between text-slate-400 mb-1.5">
            <span>Start Point:</span>
            <span className="font-mono text-white font-semibold">{startTime.toFixed(2)}s</span>
          </div>
          <input
            type="range"
            min="0"
            max={duration}
            step="0.05"
            value={startTime}
            onChange={(e) => handleStartChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
          />
        </div>

        <div>
          <div className="flex justify-between text-slate-400 mb-1.5">
            <span>End Point:</span>
            <span className="font-mono text-white font-semibold">{endTime.toFixed(2)}s</span>
          </div>
          <input
            type="range"
            min="0"
            max={duration}
            step="0.05"
            value={endTime}
            onChange={(e) => handleEndChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
          />
        </div>
      </div>

      {/* Quick Trim Shortcuts */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="text-[11px] text-slate-500 mr-1">Presets:</span>
          <button
            type="button"
            onClick={selectFirst3s}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700 transition"
          >
            First 3.0s
          </button>
          {duration > 3.0 && (
            <>
              <button
                type="button"
                onClick={selectMiddle3s}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700 transition"
              >
                Middle 3.0s
              </button>
              <button
                type="button"
                onClick={selectLast3s}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700 transition"
              >
                Last 3.0s
              </button>
            </>
          )}
        </div>

        {/* GIF Speed Up toggle */}
        {isGif && duration > 3.0 && (
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-sky-300 bg-sky-500/10 px-2.5 py-1 rounded-lg border border-sky-500/20 hover:bg-sky-500/20 transition">
            <input
              type="checkbox"
              checked={speedUpToFit}
              onChange={(e) => onToggleSpeedUp(e.target.checked)}
              className="rounded accent-sky-500"
            />
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Fit whole animation (speed up)</span>
          </label>
        )}

        {isCappedAt3 && (
          <span className="text-[11px] text-amber-400 flex items-center gap-1">
            ⚡ Clamped to Telegram 3.0s max
          </span>
        )}
      </div>
    </div>
  );
};
