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
  // Guarantee finite duration strictly bounded to video length
  const safeDuration =
    isFinite(duration) && duration > 0 && duration !== Infinity
      ? Math.round(duration * 100) / 100
      : 3.0;

  const clampedStart = Math.max(0, Math.min(startTime, safeDuration));
  const clampedEnd = Math.max(0.1, Math.min(endTime, safeDuration));
  const selectedDuration = Math.max(0.1, clampedEnd - clampedStart);
  const isCappedAt3 = selectedDuration >= 3.0;

  const handleStartChange = (val: number) => {
    const newStart = Math.max(0, Math.min(val, safeDuration - 0.1));
    let newEnd = clampedEnd;

    // Enforce max 3.0s duration rule for Telegram
    if (newEnd - newStart > 3.0) {
      newEnd = Math.min(safeDuration, newStart + 3.0);
    } else if (newEnd <= newStart) {
      newEnd = Math.min(safeDuration, newStart + 0.5);
    }

    if (newEnd > safeDuration) newEnd = safeDuration;

    onRangeChange(newStart, newEnd);
    onScrub(newStart);
  };

  const handleEndChange = (val: number) => {
    const newEnd = Math.min(safeDuration, Math.max(val, 0.2));
    let newStart = clampedStart;

    // Enforce max 3.0s duration rule for Telegram
    if (newEnd - newStart > 3.0) {
      newStart = Math.max(0, newEnd - 3.0);
    } else if (newStart >= newEnd) {
      newStart = Math.max(0, newEnd - 0.5);
    }

    if (newStart < 0) newStart = 0;

    onRangeChange(newStart, newEnd);
    onScrub(newEnd);
  };

  // Quick preset shortcuts
  const selectFirst3s = () => {
    const newEnd = Math.min(safeDuration, 3.0);
    onRangeChange(0, newEnd);
    onScrub(0);
  };

  const selectMiddle3s = () => {
    if (safeDuration <= 3.0) {
      onRangeChange(0, safeDuration);
      onScrub(0);
      return;
    }
    const mid = safeDuration / 2;
    const newStart = Math.max(0, mid - 1.5);
    const newEnd = Math.min(safeDuration, newStart + 3.0);
    onRangeChange(newStart, newEnd);
    onScrub(newStart);
  };

  const selectLast3s = () => {
    const newStart = Math.max(0, safeDuration - 3.0);
    onRangeChange(newStart, safeDuration);
    onScrub(newStart);
  };

  const stepSize = Math.min(0.05, Math.max(0.01, safeDuration / 200));

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scissors className="w-4 h-4 text-sky-600" />
          <h3 className="text-sm font-semibold text-slate-900 m-0">Timeline Trimmer & Selection</h3>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-medium border ${
              selectedDuration <= 3.0
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            Selection: {selectedDuration.toFixed(2)}s / max 3.0s
          </span>
        </div>
      </div>

      {/* Visual Timeline Bar */}
      <div className="relative h-12 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 flex items-center px-3 shadow-inner">
        {/* Background track ticks */}
        <div className="absolute inset-0 flex justify-between px-3 pointer-events-none opacity-40">
          {[0, 25, 50, 75, 100].map((tick) => (
            <div key={tick} className="h-full w-px bg-slate-300" />
          ))}
        </div>

        {/* Selected Highlight Window */}
        <div
          className="absolute top-0 bottom-0 bg-sky-500/15 border-x-2 border-sky-500 transition-all pointer-events-none"
          style={{
            left: `${(clampedStart / safeDuration) * 100}%`,
            width: `${(selectedDuration / safeDuration) * 100}%`,
          }}
        >
          <div className="absolute top-1 left-2 text-[10px] font-mono text-sky-700 font-bold">
            {selectedDuration.toFixed(2)}s
          </div>
        </div>

        <div className="relative z-10 w-full flex items-center justify-between text-[11px] font-mono text-slate-500 select-none">
          <span>0.0s</span>
          <span className="text-sky-700 font-semibold bg-white/95 px-2 py-0.5 rounded border border-slate-200 shadow-xs">
            {clampedStart.toFixed(2)}s → {clampedEnd.toFixed(2)}s
          </span>
          <span>{safeDuration.toFixed(1)}s</span>
        </div>
      </div>

      {/* Dual Sliders clamped to safeDuration */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div>
          <div className="flex justify-between text-slate-600 mb-1.5">
            <span>Start Point:</span>
            <span className="font-mono text-slate-900 font-semibold">{clampedStart.toFixed(2)}s</span>
          </div>
          <input
            type="range"
            min={0}
            max={safeDuration}
            step={stepSize}
            value={clampedStart}
            onChange={(e) => handleStartChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
        </div>

        <div>
          <div className="flex justify-between text-slate-600 mb-1.5">
            <span>End Point:</span>
            <span className="font-mono text-slate-900 font-semibold">{clampedEnd.toFixed(2)}s</span>
          </div>
          <input
            type="range"
            min={0}
            max={safeDuration}
            step={stepSize}
            value={clampedEnd}
            onChange={(e) => handleEndChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
        </div>
      </div>

      {/* Quick Trim Shortcuts */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <span className="text-[11px] text-slate-400 mr-1">Presets:</span>
          <button
            type="button"
            onClick={selectFirst3s}
            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium border border-slate-200 transition cursor-pointer"
          >
            First 3.0s
          </button>
          {safeDuration > 3.0 && (
            <>
              <button
                type="button"
                onClick={selectMiddle3s}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium border border-slate-200 transition cursor-pointer"
              >
                Middle 3.0s
              </button>
              <button
                type="button"
                onClick={selectLast3s}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium border border-slate-200 transition cursor-pointer"
              >
                Last 3.0s
              </button>
            </>
          )}
        </div>

        {/* GIF Speed Up toggle */}
        {isGif && safeDuration > 3.0 && (
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200 hover:bg-sky-100 transition">
            <input
              type="checkbox"
              checked={speedUpToFit}
              onChange={(e) => onToggleSpeedUp(e.target.checked)}
              className="rounded accent-sky-500"
            />
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Fit whole animation (speed up)</span>
          </label>
        )}

        {isCappedAt3 && (
          <span className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
            ⚡ Clamped to Telegram 3.0s max
          </span>
        )}
      </div>
    </div>
  );
};
