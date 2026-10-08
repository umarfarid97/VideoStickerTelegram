import React, { useState, useRef, useEffect } from 'react';
import {
  VolumeX,
  Eye,
  CheckCircle2,
  Sparkles,
  Play,
  Pause,
  Download,
  Film,
} from 'lucide-react';
import type { ValidationReport } from '../utils/converter';

interface PreviewChatMockupProps {
  sourceUrl: string | null;
  outputUrl: string | null;
  activeTab: 'source' | 'result';
  onTabChange: (tab: 'source' | 'result') => void;
  startTime: number;
  endTime: number;
  scrubTime: number | null;
  dimensions: { width: number; height: number };
  outputReport: ValidationReport | null;
  isGif: boolean;
  onDownload?: () => void;
}

export const PreviewChatMockup: React.FC<PreviewChatMockupProps> = ({
  sourceUrl,
  outputUrl,
  activeTab,
  onTabChange,
  startTime,
  endTime,
  scrubTime,
  dimensions,
  outputReport,
  isGif,
  onDownload,
}) => {
  const [theme, setTheme] = useState<'tg-dark' | 'tg-light' | 'checkerboard'>('tg-dark');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackTime, setPlaybackTime] = useState<number>(startTime);

  const videoRef = useRef<HTMLVideoElement>(null);

  // If user scrubs the slider, seek video to scrub time immediately
  useEffect(() => {
    if (scrubTime !== null && videoRef.current && activeTab === 'source') {
      videoRef.current.currentTime = scrubTime;
      setPlaybackTime(scrubTime);
    }
  }, [scrubTime, activeTab]);

  // Sync playback within [startTime, endTime] for source preview
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (activeTab === 'source' && !isGif) {
      if (video.currentTime < startTime || video.currentTime > endTime) {
        video.currentTime = startTime;
      }
    }

    const handleTimeUpdate = () => {
      if (!video) return;
      if (activeTab === 'source' && !isGif) {
        setPlaybackTime(video.currentTime);
        if (video.currentTime >= endTime || video.currentTime < startTime) {
          video.currentTime = startTime;
          if (isPlaying) {
            video.play().catch(() => {});
          }
        }
      } else {
        setPlaybackTime(video.currentTime);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [startTime, endTime, activeTab, isGif, isPlaying]);

  // Auto-play when switching tabs or source
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (activeTab === 'source' && !isGif) {
      video.currentTime = startTime;
    }
    if (isPlaying) {
      video.play().catch(() => {});
    }
  }, [activeTab, sourceUrl, outputUrl]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      if (activeTab === 'source' && (video.currentTime < startTime || video.currentTime >= endTime)) {
        video.currentTime = startTime;
      }
      video.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const currentMediaUrl = activeTab === 'result' && outputUrl ? outputUrl : sourceUrl;
  const isViewingResult = activeTab === 'result' && !!outputUrl;
  const trimDuration = Math.max(0.1, endTime - startTime);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col h-full space-y-3">
      {/* Header with Mode Switcher & Background Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => onTabChange('source')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition ${
              activeTab === 'source'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Trim Selection</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/30">
              {trimDuration.toFixed(1)}s
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (outputUrl) onTabChange('result');
            }}
            disabled={!outputUrl}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition ${
              activeTab === 'result'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                : outputUrl
                ? 'text-emerald-400 hover:text-white hover:bg-slate-800/60'
                : 'text-slate-600 cursor-not-allowed'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Processed WebM</span>
            {outputReport && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/20">
                {outputReport.sizeKB} KB
              </span>
            )}
          </button>
        </div>

        {/* Theme Toggles */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
          <button
            type="button"
            onClick={() => setTheme('tg-dark')}
            className={`px-2 py-1 rounded-lg transition ${
              theme === 'tg-dark'
                ? 'bg-slate-800 text-sky-400 font-medium'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            TG Dark
          </button>
          <button
            type="button"
            onClick={() => setTheme('tg-light')}
            className={`px-2 py-1 rounded-lg transition ${
              theme === 'tg-light'
                ? 'bg-slate-800 text-sky-400 font-medium'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            TG Light
          </button>
          <button
            type="button"
            onClick={() => setTheme('checkerboard')}
            className={`px-2 py-1 rounded-lg transition ${
              theme === 'checkerboard'
                ? 'bg-slate-800 text-sky-400 font-medium'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Alpha Grid
          </button>
        </div>
      </div>

      {/* Mode Status Pill */}
      <div className="flex items-center justify-between text-xs px-1 text-slate-400">
        <div className="flex items-center gap-2">
          {isViewingResult ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Showing Processed WebM (VP9, {outputReport?.sizeKB} KB)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sky-400 font-medium bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
              <Eye className="w-3.5 h-3.5" />
              Showing Selection: {startTime.toFixed(2)}s → {endTime.toFixed(2)}s (Looping)
            </span>
          )}
        </div>

        {/* Time counter */}
        {activeTab === 'source' && !isGif && (
          <span className="font-mono text-[11px] text-slate-400">
            {playbackTime.toFixed(1)}s / {endTime.toFixed(1)}s
          </span>
        )}
      </div>

      {/* Telegram Chat Simulation Stage */}
      <div
        className={`flex-1 min-h-[340px] rounded-2xl flex items-center justify-center p-6 relative overflow-hidden transition-colors border group ${
          theme === 'tg-dark'
            ? 'bg-[#0f1721] border-[#1e2c3c]'
            : theme === 'tg-light'
            ? 'bg-[#8ca8b8] border-[#7a96a6]'
            : 'bg-checkerboard border-slate-700'
        }`}
      >
        {theme === 'tg-dark' && (
          <div className="absolute inset-0 opacity-20 telegram-bubble-pattern pointer-events-none" />
        )}

        {/* Center Sticker Container */}
        <div className="relative z-10 flex flex-col items-center">
          {currentMediaUrl ? (
            <div className="relative group max-w-[280px] sm:max-w-[320px] max-h-[320px] flex items-center justify-center">
              <video
                ref={videoRef}
                key={currentMediaUrl}
                src={currentMediaUrl}
                autoPlay
                loop={activeTab === 'result' || isGif}
                muted
                playsInline
                className="max-h-[280px] w-auto h-auto object-contain rounded-xl drop-shadow-2xl cursor-pointer"
                onClick={togglePlay}
              />

              {/* Play / Pause Overlay Button on hover */}
              <button
                type="button"
                onClick={togglePlay}
                className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:scale-105 active:scale-95"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>

              {/* Status Badge overlay */}
              <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] text-white pointer-events-none">
                <VolumeX className="w-3 h-3 text-emerald-400" />
                <span>Muted</span>
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-500 py-12">
              <Film className="w-12 h-12 mx-auto mb-2 opacity-40 text-sky-400" />
              <p className="text-xs">No media loaded</p>
            </div>
          )}

          {/* Bottom metadata tags */}
          {currentMediaUrl && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-slate-900/90 backdrop-blur-md border border-slate-700/60 text-slate-300">
                {dimensions.width} × {dimensions.height} px
              </span>

              {isViewingResult ? (
                <>
                  <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    VP9 WebM • {outputReport?.sizeKB} KB
                  </span>
                  {onDownload && (
                    <button
                      type="button"
                      onClick={onDownload}
                      className="text-[11px] font-medium px-3 py-1 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1 shadow-md shadow-emerald-500/20 transition active:scale-95"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download</span>
                    </button>
                  )}
                </>
              ) : (
                <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  Loop: {trimDuration.toFixed(2)}s
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
