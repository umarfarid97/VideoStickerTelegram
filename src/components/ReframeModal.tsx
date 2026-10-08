import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Crop,
  Check,
  RotateCcw,
  Maximize2,
  Minimize2,
  X,
  Sliders,
} from 'lucide-react';
import type { CropArea } from '../utils/converter';

interface ReframeModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaUrl: string | null;
  isGif: boolean;
  crop: CropArea;
  onCropChange: (newCrop: CropArea) => void;
  origWidth: number;
  origHeight: number;
}

export const ReframeModal: React.FC<ReframeModalProps> = ({
  isOpen,
  onClose,
  mediaUrl,
  isGif,
  crop,
  onCropChange,
  origWidth,
  origHeight,
}) => {
  const [localCrop, setLocalCrop] = useState<CropArea>(crop);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; initialCrop: CropArea }>({
    startX: 0,
    startY: 0,
    initialCrop: crop,
  });

  useEffect(() => {
    setLocalCrop(crop);
  }, [crop, isOpen]);

  // Quick preset handlers
  const handleResetFull = () => {
    setLocalCrop({ x: 0, y: 0, width: 1, height: 1 });
  };

  const handleSquareCenter = () => {
    if (origWidth >= origHeight) {
      const wFraction = origHeight / origWidth;
      const xOffset = (1 - wFraction) / 2;
      setLocalCrop({ x: Math.max(0, xOffset), y: 0, width: wFraction, height: 1 });
    } else {
      const hFraction = origWidth / origHeight;
      const yOffset = (1 - hFraction) / 2;
      setLocalCrop({ x: 0, y: Math.max(0, yOffset), width: 1, height: hFraction });
    }
  };

  const handleRemoveTopBottomBars = () => {
    // Standard 2.35:1 movie letterbox inside 16:9 frame is ~12-14% black bar top and bottom
    setLocalCrop({
      x: 0,
      y: 0.12,
      width: 1,
      height: 0.76,
    });
  };

  const handleRemoveSideBars = () => {
    // 4:3 pillarbox in 16:9 video is ~12.5% bar left and right
    setLocalCrop({
      x: 0.125,
      y: 0,
      width: 0.75,
      height: 1,
    });
  };

  // Mouse / Touch handlers for dragging and resizing the crop box
  const startDrag = (handle: string | null, clientX: number, clientY: number) => {
    setIsDragging(true);
    setActiveHandle(handle);
    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      initialCrop: { ...localCrop },
    };
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isDragging || !containerRef.current) return;

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const rect = containerRef.current.getBoundingClientRect();
      const deltaX = (clientX - dragStartRef.current.startX) / rect.width;
      const deltaY = (clientY - dragStartRef.current.startY) / rect.height;
      const initial = dragStartRef.current.initialCrop;

      if (!activeHandle) {
        // Moving the entire crop box
        let newX = initial.x + deltaX;
        let newY = initial.y + deltaY;

        newX = Math.max(0, Math.min(newX, 1 - initial.width));
        newY = Math.max(0, Math.min(newY, 1 - initial.height));

        setLocalCrop({
          ...initial,
          x: newX,
          y: newY,
        });
      } else {
        // Resizing handles
        let newX = initial.x;
        let newY = initial.y;
        let newW = initial.width;
        let newH = initial.height;

        if (activeHandle.includes('e')) {
          newW = Math.max(0.1, Math.min(initial.width + deltaX, 1 - initial.x));
        }
        if (activeHandle.includes('s')) {
          newH = Math.max(0.1, Math.min(initial.height + deltaY, 1 - initial.y));
        }
        if (activeHandle.includes('w')) {
          const maxLeftShift = initial.x;
          const clampedDeltaX = Math.max(-maxLeftShift, Math.min(deltaX, initial.width - 0.1));
          newX = initial.x + clampedDeltaX;
          newW = initial.width - clampedDeltaX;
        }
        if (activeHandle.includes('n')) {
          const maxTopShift = initial.y;
          const clampedDeltaY = Math.max(-maxTopShift, Math.min(deltaY, initial.height - 0.1));
          newY = initial.y + clampedDeltaY;
          newH = initial.height - clampedDeltaY;
        }

        setLocalCrop({
          x: Math.max(0, Math.min(newX, 0.9)),
          y: Math.max(0, Math.min(newY, 0.9)),
          width: Math.max(0.1, Math.min(newW, 1)),
          height: Math.max(0.1, Math.min(newH, 1)),
        });
      }
    },
    [isDragging, activeHandle]
  );

  const stopDrag = useCallback(() => {
    setIsDragging(false);
    setActiveHandle(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', stopDrag);
      window.addEventListener('touchmove', handleMouseMove);
      window.addEventListener('touchend', stopDrag);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopDrag);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', stopDrag);
    };
  }, [isDragging, handleMouseMove, stopDrag]);

  if (!isOpen) return null;

  const handleApply = () => {
    onCropChange(localCrop);
    onClose();
  };

  const cropPixelW = Math.round(localCrop.width * origWidth);
  const cropPixelH = Math.round(localCrop.height * origHeight);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-4xl w-full flex flex-col max-h-[92vh] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Crop className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white m-0">
                Reframe & Crop Area
              </h3>
              <p className="text-xs text-slate-400 m-0">
                Drag the box to focus on your subject or crop out black bars
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col lg:flex-row gap-6 items-center justify-center">
          {/* Visual Video Stage */}
          <div className="flex-1 w-full max-w-[560px] flex items-center justify-center">
            <div
              ref={containerRef}
              className="relative select-none overflow-hidden rounded-2xl bg-black border border-slate-800 shadow-2xl max-h-[420px] w-auto h-auto flex items-center justify-center"
              style={{
                aspectRatio: `${origWidth} / ${origHeight}`,
                maxWidth: '100%',
              }}
            >
              {/* Source Video / Frame */}
              {mediaUrl && (
                isGif ? (
                  <img
                    src={mediaUrl}
                    alt="Preview"
                    className="w-full h-full object-contain pointer-events-none opacity-60"
                  />
                ) : (
                  <video
                    src={mediaUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-contain pointer-events-none opacity-60"
                  />
                )
              )}

              {/* Shaded Outside Mask (SVG) */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                <defs>
                  <mask id="cropMask">
                    <rect width="100%" height="100%" fill="white" />
                    <rect
                      x={`${localCrop.x * 100}%`}
                      y={`${localCrop.y * 100}%`}
                      width={`${localCrop.width * 100}%`}
                      height={`${localCrop.height * 100}%`}
                      fill="black"
                    />
                  </mask>
                </defs>
                <rect
                  width="100%"
                  height="100%"
                  fill="rgba(0, 0, 0, 0.65)"
                  mask="url(#cropMask)"
                />
              </svg>

              {/* Interactive Crop Rectangle */}
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  startDrag(null, e.clientX, e.clientY);
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  startDrag(null, e.touches[0].clientX, e.touches[0].clientY);
                }}
                className="absolute z-20 border-2 border-sky-400 bg-sky-400/10 cursor-move transition-shadow hover:shadow-[0_0_20px_rgba(56,189,248,0.4)]"
                style={{
                  left: `${localCrop.x * 100}%`,
                  top: `${localCrop.y * 100}%`,
                  width: `${localCrop.width * 100}%`,
                  height: `${localCrop.height * 100}%`,
                }}
              >
                {/* Rule of Thirds Grid Lines */}
                <div className="absolute inset-0 pointer-events-none opacity-40">
                  <div className="absolute top-1/3 left-0 right-0 h-px bg-white/60" />
                  <div className="absolute top-2/3 left-0 right-0 h-px bg-white/60" />
                  <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/60" />
                  <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/60" />
                </div>

                {/* Corner Resize Handles */}
                {['nw', 'ne', 'sw', 'se'].map((pos) => (
                  <div
                    key={pos}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      startDrag(pos, e.clientX, e.clientY);
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      startDrag(pos, e.touches[0].clientX, e.touches[0].clientY);
                    }}
                    className={`absolute w-3.5 h-3.5 bg-sky-400 border border-white rounded-full z-30 transition-transform hover:scale-125 ${
                      pos === 'nw'
                        ? '-top-1.5 -left-1.5 cursor-nwse-resize'
                        : pos === 'ne'
                        ? '-top-1.5 -right-1.5 cursor-nesw-resize'
                        : pos === 'sw'
                        ? '-bottom-1.5 -left-1.5 cursor-nesw-resize'
                        : '-bottom-1.5 -right-1.5 cursor-nwse-resize'
                    }`}
                  />
                ))}

                {/* Central Crop Dimension Badge */}
                <div className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-white pointer-events-none">
                  {cropPixelW} × {cropPixelH} px
                </div>
              </div>
            </div>
          </div>

          {/* Preset Buttons & Controls Sidebar */}
          <div className="w-full lg:w-72 space-y-4 text-xs">
            {/* Quick Framing Presets */}
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-2.5">
              <span className="font-semibold text-slate-300 block">
                Quick Framing Presets
              </span>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleSquareCenter}
                  className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 flex flex-col items-center gap-1 transition"
                >
                  <Maximize2 className="w-4 h-4 text-sky-400" />
                  <span className="font-medium text-[11px]">1:1 Square</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetFull}
                  className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 flex flex-col items-center gap-1 transition"
                >
                  <RotateCcw className="w-4 h-4 text-emerald-400" />
                  <span className="font-medium text-[11px]">Full Frame</span>
                </button>
              </div>
            </div>

            {/* Black Bar Removal Presets */}
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-2.5">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>Remove Black Bars</span>
              </span>

              <button
                type="button"
                onClick={handleRemoveTopBottomBars}
                className="w-full p-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-between transition text-left"
              >
                <div>
                  <div className="font-medium text-xs">Trim Movie Letterbox</div>
                  <div className="text-[10px] text-amber-400/80">
                    Crops top & bottom bars (2.35:1)
                  </div>
                </div>
                <Minimize2 className="w-4 h-4 shrink-0" />
              </button>

              <button
                type="button"
                onClick={handleRemoveSideBars}
                className="w-full p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center justify-between transition text-left"
              >
                <div>
                  <div className="font-medium text-xs">Trim Side Pillarbox</div>
                  <div className="text-[10px] text-slate-400">
                    Crops left & right vertical bars
                  </div>
                </div>
                <Minimize2 className="w-4 h-4 shrink-0" />
              </button>
            </div>

            {/* Hint */}
            <p className="text-[11px] text-slate-400 px-1 leading-relaxed">
              💡 Telegram stickers scale the longest side to <strong>512px</strong>. Reframing closer to your subject makes your sticker bigger and clearer!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleResetFull}
            className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-medium transition"
          >
            Reset Full Frame
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-sky-500/20 transition active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>Apply Reframe</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
