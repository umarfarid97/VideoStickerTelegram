import React, { useState } from 'react';
import { VolumeX, Layers, Eye } from 'lucide-react';

interface PreviewChatMockupProps {
  previewUrl: string | null;
  dimensions: { width: number; height: number };
  isWebmResult?: boolean;
}

export const PreviewChatMockup: React.FC<PreviewChatMockupProps> = ({
  previewUrl,
  dimensions,
  isWebmResult = false,
}) => {
  const [theme, setTheme] = useState<'tg-dark' | 'tg-light' | 'checkerboard'>('tg-dark');

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-sky-400" />
          <h3 className="text-sm font-semibold text-white m-0">Telegram Chat Preview</h3>
        </div>

        {/* Theme Toggles */}
        <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60 text-[11px]">
          <button
            onClick={() => setTheme('tg-dark')}
            className={`px-2 py-0.5 rounded-md transition ${
              theme === 'tg-dark'
                ? 'bg-sky-500 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            TG Dark
          </button>
          <button
            onClick={() => setTheme('tg-light')}
            className={`px-2 py-0.5 rounded-md transition ${
              theme === 'tg-light'
                ? 'bg-sky-500 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            TG Light
          </button>
          <button
            onClick={() => setTheme('checkerboard')}
            className={`px-2 py-0.5 rounded-md transition ${
              theme === 'checkerboard'
                ? 'bg-sky-500 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Alpha Grid
          </button>
        </div>
      </div>

      {/* Telegram Chat Simulation Stage */}
      <div
        className={`flex-1 min-h-[320px] rounded-xl flex items-center justify-center p-6 relative overflow-hidden transition-colors border ${
          theme === 'tg-dark'
            ? 'bg-[#0f1721] border-[#1e2c3c]'
            : theme === 'tg-light'
            ? 'bg-[#8ca8b8] border-[#7a96a6]'
            : 'bg-checkerboard border-slate-700'
        }`}
      >
        {/* Subtle decorative chat pattern for TG Dark */}
        {theme === 'tg-dark' && (
          <div className="absolute inset-0 opacity-20 telegram-bubble-pattern pointer-events-none" />
        )}

        {/* Sticker container */}
        <div className="relative z-10 flex flex-col items-center">
          {previewUrl ? (
            <div className="relative group max-w-[280px] sm:max-w-[320px] max-h-[320px]">
              <video
                src={previewUrl}
                autoPlay
                loop
                muted
                playsInline
                className="max-h-[280px] w-auto h-auto object-contain rounded-lg drop-shadow-2xl"
              />

              {/* Overlay badges */}
              <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] text-white">
                <VolumeX className="w-3 h-3 text-emerald-400" />
                <span>Audio Muted</span>
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-500 py-12">
              <Layers className="w-12 h-12 mx-auto mb-2 opacity-40 text-sky-400" />
              <p className="text-xs">No media loaded</p>
            </div>
          )}

          {/* Dimension pill */}
          {previewUrl && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-slate-300">
                {dimensions.width} × {dimensions.height} px
              </span>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-emerald-400 flex items-center gap-1">
                <VolumeX className="w-3 h-3" /> No Audio
              </span>
              {isWebmResult && (
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  VP9 WebM
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
