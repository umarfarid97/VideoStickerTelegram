import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Scissors, Clock, Zap } from 'lucide-react';

interface TimelineTrimmerProps {
  videoUrl: string | null;
  duration: number;
  startTime: number;
  endTime: number;
  onRangeChange: (start: number, end: number) => void;
  isGif: boolean;
  speedUpToFit: boolean;
  onToggleSpeedUp: (val: boolean) => void;
}

export const TimelineTrimmer: React.FC<TimelineTrimmerProps> = ({
  videoUrl,
  duration,
  startTime,
  endTime,
  onRangeChange,
  isGif,
  speedUpToFit,
  onToggleSpeedUp,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const selectedDuration = Math.max(0, endTime - startTime);
  const isCappedAt3 = selectedDuration >= 3.0;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.currentTime >= endTime) {
        video.currentTime = startTime;
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [startTime, endTime]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      if (video.currentTime < startTime || video.currentTime >= endTime) {
        video.currentTime = startTime;
      }
      video.play();
      setIsPlaying(true);
    }
  };

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
    if (videoRef.current) {
      videoRef.current.currentTime = newStart;
    }
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
    if (videoRef.current) {
      videoRef.current.currentTime = newStart;
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Scissors className="w-4 h-4 text-sky-400" />
          <h3 className="text-sm font-semibold text-white m-0">Duration & Timeline Trim</h3>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-medium border ${
              selectedDuration <= 3.0
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}
          >
            {selectedDuration.toFixed(2)}s / max 3.0s
          </span>
        </div>
      </div>

      {/* Hidden/offscreen video element for timeline synchronization if video */}
      {videoUrl && !isGif && (
        <video
          ref={videoRef}
          src={videoUrl}
          playsInline
          muted
          className="hidden"
        />
      )}

      {/* Timeline Bar visualization */}
      <div className="space-y-4">
        <div className="relative h-10 bg-slate-800/80 rounded-xl overflow-hidden border border-slate-700/60 flex items-center px-3">
          {/* Active selection region */}
          <div
            className="absolute top-0 bottom-0 bg-sky-500/20 border-x-2 border-sky-400 pointer-events-none transition-all duration-75"
            style={{
              left: `${(startTime / duration) * 100}%`,
              width: `${(selectedDuration / duration) * 100}%`,
            }}
          />

          {/* Current playhead */}
          {!isGif && videoUrl && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10 pointer-events-none"
              style={{
                left: `${(currentTime / duration) * 100}%`,
              }}
            />
          )}

          <div className="relative z-10 w-full flex items-center justify-between text-[11px] font-mono text-slate-400 select-none">
            <span>0.0s</span>
            <span className="text-sky-300 font-semibold">
              Selected: {startTime.toFixed(1)}s - {endTime.toFixed(1)}s
            </span>
            <span>{duration.toFixed(1)}s</span>
          </div>
        </div>

        {/* Dual Range Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <div className="flex justify-between text-slate-400 mb-1">
              <span>Start Time:</span>
              <span className="font-mono text-white">{startTime.toFixed(2)}s</span>
            </div>
            <input
              type="range"
              min="0"
              max={duration}
              step="0.05"
              value={startTime}
              onChange={(e) => handleStartChange(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-400 mb-1">
              <span>End Time:</span>
              <span className="font-mono text-white">{endTime.toFixed(2)}s</span>
            </div>
            <input
              type="range"
              min="0"
              max={duration}
              step="0.05"
              value={endTime}
              onChange={(e) => handleEndChange(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
            />
          </div>
        </div>

        {/* Trimming helpers & GIF speed up toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800/80">
          {!isGif && videoUrl ? (
            <button
              onClick={togglePlay}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 text-sky-400" /> : <Play className="w-3.5 h-3.5 text-sky-400" />}
              <span>{isPlaying ? 'Pause Trimmer' : 'Preview Selection'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>GIF Animation: {duration.toFixed(2)}s natural duration</span>
            </div>
          )}

          {isGif && duration > 3.0 && (
            <label className="flex items-center gap-2 cursor-pointer text-xs text-sky-300 bg-sky-500/10 px-2.5 py-1.5 rounded-lg border border-sky-500/20 hover:bg-sky-500/20 transition">
              <input
                type="checkbox"
                checked={speedUpToFit}
                onChange={(e) => onToggleSpeedUp(e.target.checked)}
                className="rounded accent-sky-500"
              />
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Speed up entire animation to fit 3.0s</span>
            </label>
          )}

          {isCappedAt3 && (
            <span className="text-[11px] text-amber-400/90 flex items-center gap-1">
              ⚡ Telegram auto-capped at 3.0s maximum duration
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
