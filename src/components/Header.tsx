import React, { useState } from 'react';
import { Send, Info, ShieldCheck, Sparkles, X, CheckCircle2 } from 'lucide-react';

export const Header: React.FC = () => {
  const [showSpecsModal, setShowSpecsModal] = useState(false);

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-40 shadow-xs">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
            <Send className="w-5 h-5 -translate-x-0.5 translate-y-0.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 m-0 font-sans">
                Telegram Video Sticker Studio
              </h1>
              <span className="text-xs px-2 py-0.5 font-medium rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                WebM VP9
              </span>
            </div>
            <p className="text-xs text-slate-500 m-0">
              Convert videos & GIFs to Telegram stickers right in your browser
            </p>
          </div>
        </div>

        {/* Action / Badges */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>100% Client-Side (Zero Upload)</span>
          </div>

          <button
            onClick={() => setShowSpecsModal(true)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 transition border border-slate-200 hover:border-slate-300 shadow-xs cursor-pointer"
          >
            <Info className="w-3.5 h-3.5 text-sky-600" />
            <span>Telegram Specs</span>
          </button>
        </div>
      </div>

      {/* Telegram Requirements Modal */}
      {showSpecsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in duration-200">
            <button
              onClick={() => setShowSpecsModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-sky-600" />
              <h2 className="text-lg font-bold text-slate-900 m-0">Telegram Video Sticker Requirements</h2>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              Telegram has strict technical criteria for stickers accepted by the <code className="text-sky-700 bg-sky-50 px-1 py-0.5 rounded font-mono border border-sky-100">@Stickers</code> bot:
            </p>

            <div className="space-y-2.5 text-xs text-slate-700">
              <div className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900">Format & Codec:</strong> WebM container encoded with <strong>VP9</strong> codec (<code className="font-mono text-sky-700">libvpx-vp9</code>).
                </div>
              </div>

              <div className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900">Dimensions:</strong> Exactly <strong>512 pixels</strong> on one side, and <strong>512 pixels or less</strong> on the other side (e.g. 512×512, 512×288, 320×512).
                </div>
              </div>

              <div className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900">File Size:</strong> Maximum <strong>256 KB</strong> (strict limit, files above this are rejected).
                </div>
              </div>

              <div className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900">Duration:</strong> Up to <strong>3.0 seconds</strong> maximum.
                </div>
              </div>

              <div className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900">Framerate & Audio:</strong> Up to <strong>30 FPS</strong>. Audio stream must be <strong>removed completely</strong>.
                </div>
              </div>

              <div className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900">Transparency:</strong> Alpha channel transparency is fully supported.
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowSpecsModal(false)}
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-medium text-xs transition cursor-pointer"
              >
                Got it, thanks!
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
