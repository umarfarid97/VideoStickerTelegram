import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Crop,
  Check,
  RotateCcw,
  Maximize2,
  Minimize2,
  X,
  Sliders,
  Square,
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
  initialAspectMode?: '1:1' | 'free';
  onApplyMode?: (mode: 'square512' | 'free' | 'full') => void;
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
  initialAspectMode = 'free',
  onApplyMode,
}) => {
  const [localCrop, setLocalCrop] = useState<CropArea>(crop);
  const [aspectMode, setAspectMode] = useState<'1:1' | 'free'>(initialAspectMode);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; initialCrop: CropArea }>({
    startX: 0,
    startY: 0,
    initialCrop: crop,
  });

  // Calculate centered 1:1 square crop
  const getCenteredSquareCrop = useCallback((): CropArea => {
    if (origWidth <= 0 || origHeight <= 0) return { x: 0, y: 0, width: 1, height: 1 };
    if (origWidth >= origHeight) {
      const wFraction = origHeight / origWidth;
      const xOffset = (1 - wFraction) / 2;
      return { x: Math.max(0, xOffset), y: 0, width: wFraction, height: 1 };
    } else {
      const hFraction = origWidth / origHeight;
      const yOffset = (1 - hFraction) / 2;
      return { x: 0, y: Math.max(0, yOffset), width: 1, height: hFraction };
    }
  }, [origWidth, origHeight]);

  // Force any existing crop area to become a 1:1 pixel square
  const forceSquareCrop = useCallback(
    (current: CropArea): CropArea => {
      if (origWidth <= 0 || origHeight <= 0) return getCenteredSquareCrop();
      const cx = current.x + current.width / 2;
      const cy = current.y + current.height / 2;
      const pixelW = current.width * origWidth;
      const pixelH = current.height * origHeight;

      let squareSizePx = Math.min(pixelW, pixelH);
      if (squareSizePx < 20) squareSizePx = Math.min(origWidth, origHeight) * 0.8;

      let normW = squareSizePx / origWidth;
      let normH = squareSizePx / origHeight;

      if (normW > 1) {
        normW = 1;
        normH = origWidth / origHeight;
      }
      if (normH > 1) {
        normH = 1;
        normW = origHeight / origWidth;
      }

      let x = cx - normW / 2;
      let y = cy - normH / 2;

      x = Math.max(0, Math.min(x, 1 - normW));
      y = Math.max(0, Math.min(y, 1 - normH));

      return { x, y, width: normW, height: normH };
    },
    [origWidth, origHeight, getCenteredSquareCrop]
  );

  useEffect(() => {
    if (isOpen) {
      setAspectMode(initialAspectMode);
      if (initialAspectMode === '1:1') {
        setLocalCrop(forceSquareCrop(crop));
      } else {
        setLocalCrop(crop);
      }
    }
  }, [isOpen, initialAspectMode, crop, forceSquareCrop]);

  const handleSwitchAspectMode = (mode: '1:1' | 'free') => {
    setAspectMode(mode);
    if (mode === '1:1') {
      setLocalCrop((prev) => forceSquareCrop(prev));
    }
  };

  // Quick preset handlers
  const handleResetFull = () => {
    setAspectMode('free');
    setLocalCrop({ x: 0, y: 0, width: 1, height: 1 });
  };

  const handleSquareCenter = () => {
    setAspectMode('1:1');
    setLocalCrop(getCenteredSquareCrop());
  };

  const handleRemoveTopBottomBars = () => {
    setAspectMode('free');
    // Standard 2.35:1 movie letterbox inside 16:9 frame is ~12-14% black bar top and bottom
    setLocalCrop({
      x: 0,
      y: 0.12,
      width: 1,
      height: 0.76,
    });
  };

  const handleRemoveSideBars = () => {
    setAspectMode('free');
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
        if (aspectMode === '1:1') {
          // Locked 1:1 pixel square aspect ratio
          const videoRatio = origWidth / Math.max(1, origHeight); // width / height

          if (activeHandle === 'se') {
            const candidateW = initial.width + deltaX;
            const maxW = Math.min(1 - initial.x, (1 - initial.y) / videoRatio);
            const minW = Math.max(0.1, 0.1 / videoRatio);
            const clampedW = Math.max(minW, Math.min(candidateW, maxW));
            const clampedH = clampedW * videoRatio;
            setLocalCrop({
              x: initial.x,
              y: initial.y,
              width: clampedW,
              height: clampedH,
            });
          } else if (activeHandle === 'sw') {
            const candidateW = initial.width - deltaX;
            const rightEdge = initial.x + initial.width;
            const maxW = Math.min(rightEdge, (1 - initial.y) / videoRatio);
            const minW = Math.max(0.1, 0.1 / videoRatio);
            const clampedW = Math.max(minW, Math.min(candidateW, maxW));
            const clampedH = clampedW * videoRatio;
            setLocalCrop({
              x: rightEdge - clampedW,
              y: initial.y,
              width: clampedW,
              height: clampedH,
            });
          } else if (activeHandle === 'ne') {
            const candidateW = initial.width + deltaX;
            const bottomEdge = initial.y + initial.height;
            const maxW = Math.min(1 - initial.x, bottomEdge / videoRatio);
            const minW = Math.max(0.1, 0.1 / videoRatio);
            const clampedW = Math.max(minW, Math.min(candidateW, maxW));
            const clampedH = clampedW * videoRatio;
            setLocalCrop({
              x: initial.x,
              y: bottomEdge - clampedH,
              width: clampedW,
              height: clampedH,
            });
          } else if (activeHandle === 'nw') {
            const candidateW = initial.width - deltaX;
            const rightEdge = initial.x + initial.width;
            const bottomEdge = initial.y + initial.height;
            const maxW = Math.min(rightEdge, bottomEdge / videoRatio);
            const minW = Math.max(0.1, 0.1 / videoRatio);
            const clampedW = Math.max(minW, Math.min(candidateW, maxW));
            const clampedH = clampedW * videoRatio;
            setLocalCrop({
              x: rightEdge - clampedW,
              y: bottomEdge - clampedH,
              width: clampedW,
              height: clampedH,
            });
          }
        } else {
          // Free-form resizing
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
      }
    },
    [isDragging, activeHandle, aspectMode, origWidth, origHeight]
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
    if (onApplyMode) {
      if (aspectMode === '1:1') {
        onApplyMode('square512');
      } else if (localCrop.x === 0 && localCrop.y === 0 && localCrop.width === 1 && localCrop.height === 1) {
        onApplyMode('full');
      } else {
        onApplyMode('free');
      }
    }
    onClose();
  };

  const cropPixelW = Math.round(localCrop.width * origWidth);
  const cropPixelH = Math.round(localCrop.height * origHeight);

  // Compute final Telegram sticker dimensions (longest side 512px, even numbers)
  let stickerW = 512;
  let stickerH = 512;
  if (cropPixelW >= cropPixelH) {
    stickerW = 512;
    stickerH = Math.max(2, Math.round(((512 * cropPixelH) / cropPixelW) / 2) * 2);
  } else {
    stickerH = 512;
    stickerW = Math.max(2, Math.round(((512 * cropPixelW) / cropPixelH) / 2) * 2);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-4xl w-full flex flex-col max-h-[92vh] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
              <Crop className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 m-0">
                Select Framing & Crop Area
              </h3>
              <p className="text-xs text-slate-500 m-0">
                Drag to frame your subject or choose 1:1 square for Telegram 512×512
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Switcher Buttons */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => handleSwitchAspectMode('1:1')}
                className={`px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  aspectMode === '1:1'
                    ? 'bg-white text-sky-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Square className="w-3.5 h-3.5 text-sky-600" />
                <span>512×512 Square</span>
              </button>

              <button
                type="button"
                onClick={() => handleSwitchAspectMode('free')}
                className={`px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  aspectMode === 'free'
                    ? 'bg-white text-sky-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Maximize2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Free Reframing</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
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
                <div className="absolute bottom-2 left-2 bg-black/85 backdrop-blur-md px-2.5 py-1 rounded text-[11px] font-mono text-white pointer-events-none shadow-md">
                  <span className="text-sky-300 font-semibold">{cropPixelW} × {cropPixelH} px</span>
                  <span className="text-slate-400 ml-1.5">➔ {stickerW} × {stickerH} px</span>
                </div>
              </div>
            </div>
          </div>

          {/* Preset Buttons & Controls Sidebar */}
          <div className="w-full lg:w-72 space-y-4 text-xs">
            {/* Quick Framing Presets */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2.5">
              <span className="font-semibold text-slate-800 block">
                Quick Framing Presets
              </span>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleSquareCenter}
                  className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition shadow-2xs cursor-pointer ${
                    aspectMode === '1:1'
                      ? 'bg-sky-50 border-sky-300 text-sky-900 font-semibold'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <Square className="w-4 h-4 text-sky-600" />
                  <span className="text-[11px]">Center 1:1</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetFull}
                  className="p-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 flex flex-col items-center gap-1 transition shadow-2xs cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 text-emerald-600" />
                  <span className="font-medium text-[11px]">Full Frame</span>
                </button>
              </div>
            </div>

            {/* Black Bar Removal Presets */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2.5">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-600" />
                <span>Remove Black Bars</span>
              </span>

              <button
                type="button"
                onClick={handleRemoveTopBottomBars}
                className="w-full p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100/80 text-amber-900 border border-amber-200 flex items-center justify-between transition text-left cursor-pointer"
              >
                <div>
                  <div className="font-medium text-xs">Trim Movie Letterbox</div>
                  <div className="text-[10px] text-amber-700">
                    Crops top & bottom bars (2.35:1)
                  </div>
                </div>
                <Minimize2 className="w-4 h-4 shrink-0 text-amber-600" />
              </button>

              <button
                type="button"
                onClick={handleRemoveSideBars}
                className="w-full p-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-between transition text-left shadow-2xs cursor-pointer"
              >
                <div>
                  <div className="font-medium text-xs">Trim Side Pillarbox</div>
                  <div className="text-[10px] text-slate-500">
                    Crops left & right vertical bars
                  </div>
                </div>
                <Minimize2 className="w-4 h-4 shrink-0 text-slate-500" />
              </button>
            </div>

            {/* Telegram 512px rule explanation */}
            <div className="p-3 bg-sky-50/70 border border-sky-100 rounded-xl text-[11px] text-slate-600 leading-relaxed">
              <p className="m-0 font-medium text-sky-900 mb-1">
                📐 Telegram Sticker Sizing:
              </p>
              <p className="m-0">
                • <strong>512×512 Square</strong> generates an exact 512×512 sticker with no black bars.
              </p>
              <p className="m-0 mt-1">
                • <strong>Free / Full</strong> scales the longest side to 512px (e.g. 512×{stickerH} px).
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleResetFull}
            className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-900 text-xs font-medium transition cursor-pointer"
          >
            Reset to Full Frame
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-sky-500/20 transition active:scale-95 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Apply Selection</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
