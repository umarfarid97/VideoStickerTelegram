import React from 'react';
import { CheckCircle2, AlertTriangle, Download, ArrowRight, RefreshCcw } from 'lucide-react';
import type { ValidationReport } from '../utils/converter';

interface ValidationBadgeProps {
  report: ValidationReport | null;
  onDownload: () => void;
  onRecompressEco: () => void;
  isProcessing: boolean;
}

export const ValidationBadge: React.FC<ValidationBadgeProps> = ({
  report,
  onDownload,
  onRecompressEco,
  isProcessing,
}) => {
  if (!report) return null;

  const {
    isValid,
    sizeKB,
    isSizeValid,
    durationSeconds,
    isDurationValid,
    dimensions,
    isDimensionsValid,
    fps,
    isFpsValid,
    hasAudio,
  } = report;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
      {/* Overall Status Banner */}
      <div
        className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
          isValid
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
        }`}
      >
        <div className="flex items-center gap-2.5">
          {isValid ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <div>
            <div className="font-semibold text-sm">
              {isValid ? 'Telegram Sticker Compliant! 🎉' : 'Does not meet all Telegram criteria'}
            </div>
            <div className="text-xs opacity-80">
              {isValid
                ? 'Ready to upload to @Stickers bot directly.'
                : 'Adjust settings or use the auto-compress button below.'}
            </div>
          </div>
        </div>

        {isValid && (
          <button
            onClick={onDownload}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Download .webm</span>
          </button>
        )}
      </div>

      {/* Criteria Breakdown Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
        {/* Codec */}
        <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50">
          <div className="text-slate-400 text-[11px] mb-1">Codec & Container</div>
          <div className="flex items-center gap-1.5 font-medium text-white">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>WebM (VP9)</span>
          </div>
        </div>

        {/* File Size */}
        <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50">
          <div className="text-slate-400 text-[11px] mb-1">File Size (Max 256 KB)</div>
          <div className="flex items-center gap-1.5 font-medium">
            {isSizeValid ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span className={isSizeValid ? 'text-white' : 'text-rose-400 font-bold'}>
              {sizeKB} KB
            </span>
          </div>
        </div>

        {/* Duration */}
        <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50">
          <div className="text-slate-400 text-[11px] mb-1">Duration (Max 3.0s)</div>
          <div className="flex items-center gap-1.5 font-medium">
            {isDurationValid ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span className={isDurationValid ? 'text-white' : 'text-rose-400 font-bold'}>
              {durationSeconds}s
            </span>
          </div>
        </div>

        {/* Dimensions */}
        <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50">
          <div className="text-slate-400 text-[11px] mb-1">Resolution (512px rule)</div>
          <div className="flex items-center gap-1.5 font-medium">
            {isDimensionsValid ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span className={isDimensionsValid ? 'text-white' : 'text-rose-400 font-bold'}>
              {dimensions.width}×{dimensions.height}
            </span>
          </div>
        </div>

        {/* Framerate */}
        <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50">
          <div className="text-slate-400 text-[11px] mb-1">Framerate (Max 30 FPS)</div>
          <div className="flex items-center gap-1.5 font-medium">
            {isFpsValid ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span className={isFpsValid ? 'text-white' : 'text-rose-400 font-bold'}>
              {fps} FPS
            </span>
          </div>
        </div>

        {/* Audio */}
        <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50">
          <div className="text-slate-400 text-[11px] mb-1">Audio Track</div>
          <div className="flex items-center gap-1.5 font-medium text-white">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>None ({hasAudio ? 'Present' : 'Stripped'})</span>
          </div>
        </div>
      </div>

      {/* Auto Re-compress Button if size exceeds 256 KB */}
      {!isSizeValid && (
        <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl flex items-center justify-between gap-3">
          <span className="text-xs text-rose-300">
            Output is {sizeKB} KB (exceeds 256 KB limit). Click below to re-encode at optimized lower bitrate.
          </span>
          <button
            onClick={onRecompressEco}
            disabled={isProcessing}
            className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-medium text-xs flex items-center gap-1 shrink-0 transition"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            <span>Auto-Compress &lt; 256 KB</span>
          </button>
        </div>
      )}

      {/* Bottom Download Bar */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
        <span className="text-xs text-slate-400">
          Ready to save: <code className="text-sky-300">sticker.webm</code> ({sizeKB} KB)
        </span>
        <button
          onClick={onDownload}
          disabled={isProcessing}
          className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-medium text-xs flex items-center gap-2 shadow-lg shadow-sky-500/20 transition active:scale-95 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          <span>Save Video Sticker</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
