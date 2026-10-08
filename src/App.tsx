import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  Sparkles,
  Settings2,
  Cpu,
  Loader2,
  AlertCircle,
  Film,
  Zap,
  Crop,
  Sliders,
  Square,
  Check,
} from 'lucide-react';
import { Header } from './components/Header';
import { Dropzone } from './components/Dropzone';
import { TimelineTrimmer } from './components/TimelineTrimmer';
import { PreviewChatMockup } from './components/PreviewChatMockup';
import { ValidationBadge } from './components/ValidationBadge';
import { TelegramBotGuide } from './components/TelegramBotGuide';
import { ReframeModal } from './components/ReframeModal';
import {
  convertVideoToWebM,
  convertGifToWebM,
  getVideoMetadata,
  isWebCodecsSupported,
  calculateDimensions,
  type StickerOptions,
  type ValidationReport,
  type CropArea,
} from './utils/converter';
import { parseGIF, decompressFrames } from 'gifuct-js';

type FramingMode = 'full' | 'square512' | 'free';

export const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isGif, setIsGif] = useState<boolean>(false);

  // Metadata
  const [naturalDuration, setNaturalDuration] = useState<number>(3.0);
  const [origWidth, setOrigWidth] = useState<number>(512);
  const [origHeight, setOrigHeight] = useState<number>(512);

  // Framing & Dimensions state
  const [framingMode, setFramingMode] = useState<FramingMode>('full');
  const [modalAspectMode, setModalAspectMode] = useState<'1:1' | 'free'>('free');
  const [mode, setMode] = useState<'fit' | 'pad' | 'crop'>('fit');
  const [crop, setCrop] = useState<CropArea>({ x: 0, y: 0, width: 1, height: 1 });
  const [isReframeOpen, setIsReframeOpen] = useState<boolean>(false);

  // Trimming
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(3.0);
  const [fps, setFps] = useState<number>(30);
  const [quality, setQuality] = useState<'high' | 'medium' | 'low'>('high');
  const [speedUpToFit, setSpeedUpToFit] = useState<boolean>(true);

  // Scrubbing & Active Preview View
  const [activePreviewTab, setActivePreviewTab] = useState<'source' | 'result'>('source');
  const [scrubTime, setScrubTime] = useState<number | null>(null);

  // Processing state
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [progressStage, setProgressStage] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Results
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);

  const supported = isWebCodecsSupported();

  // Helper for computing centered 1:1 square crop
  const getCenteredSquareCrop = useCallback((w: number, h: number): CropArea => {
    if (w <= 0 || h <= 0) return { x: 0, y: 0, width: 1, height: 1 };
    if (w >= h) {
      const wFraction = h / w;
      const xOffset = (1 - wFraction) / 2;
      return { x: Math.max(0, xOffset), y: 0, width: wFraction, height: 1 };
    } else {
      const hFraction = w / h;
      const yOffset = (1 - hFraction) / 2;
      return { x: 0, y: Math.max(0, yOffset), width: 1, height: hFraction };
    }
  }, []);

  // Selection handlers for the 3 framing options
  const handleSelectFull = () => {
    setFramingMode('full');
    setCrop({ x: 0, y: 0, width: 1, height: 1 });
    setMode('fit');
    setActivePreviewTab('source');
  };

  const handleSelectSquare512 = (openModal = false) => {
    setFramingMode('square512');
    setModalAspectMode('1:1');
    setMode('fit');
    // If currently full or not roughly 1:1, reset to centered 1:1 square
    const curAspect = (crop.width * origWidth) / Math.max(1, crop.height * origHeight);
    if ((crop.width === 1 && crop.height === 1) || Math.abs(curAspect - 1) > 0.05) {
      setCrop(getCenteredSquareCrop(origWidth, origHeight));
    }
    setActivePreviewTab('source');
    if (openModal) {
      setIsReframeOpen(true);
    }
  };

  const handleSelectFree = (openModal = false) => {
    setFramingMode('free');
    setModalAspectMode('free');
    setMode('fit');
    setActivePreviewTab('source');
    if (openModal) {
      setIsReframeOpen(true);
    }
  };

  // Reset or clear file
  const handleReset = () => {
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setFile(null);
    setMediaUrl(null);
    setOutputBlob(null);
    setOutputUrl(null);
    setValidationReport(null);
    setErrorMsg(null);
    setProgress(0);
    setActivePreviewTab('source');
    setScrubTime(null);
    setCrop({ x: 0, y: 0, width: 1, height: 1 });
    setFramingMode('full');
    setMode('fit');
  };

  // When a new file is dropped/chosen
  const handleFileSelect = async (selectedFile: File) => {
    handleReset();
    setFile(selectedFile);
    const isGifFile = selectedFile.type === 'image/gif' || /\.gif$/i.test(selectedFile.name);
    setIsGif(isGifFile);

    const objectUrl = URL.createObjectURL(selectedFile);
    setMediaUrl(objectUrl);
    setActivePreviewTab('source');

    try {
      if (isGifFile) {
        const buffer = await selectedFile.arrayBuffer();
        const parsed = parseGIF(buffer);
        const frames = decompressFrames(parsed, false);
        const gifW = parsed.lsd.width || 512;
        const gifH = parsed.lsd.height || 512;
        let dur = frames.reduce((acc, f) => acc + (f.delay || 100), 0) / 1000;
        if (dur <= 0) dur = frames.length * 0.1;

        setOrigWidth(gifW);
        setOrigHeight(gifH);
        setNaturalDuration(dur);
        setStartTime(0);
        setEndTime(Math.min(dur, 3.0));
        setSpeedUpToFit(dur > 3.0);
      } else {
        const meta = await getVideoMetadata(objectUrl);
        setOrigWidth(meta.width);
        setOrigHeight(meta.height);
        setNaturalDuration(meta.duration);
        setStartTime(0);
        setEndTime(Math.min(meta.duration, 3.0));
      }
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg((err as Error).message || 'Failed to inspect file properties.');
    }
  };

  // Convert execution
  const handleConvert = async (customQuality?: 'high' | 'medium' | 'low') => {
    if (!file) return;
    setErrorMsg(null);
    setIsConverting(true);
    setProgress(2);
    setProgressStage('Initializing VP9 WebCodecs...');

    const chosenQuality = customQuality || quality;
    if (customQuality) setQuality(customQuality);

    const options: StickerOptions = {
      mode,
      startTime,
      endTime,
      fps,
      quality: chosenQuality,
      speedUpToFit,
      loopPlayback: true,
      crop,
    };

    try {
      let res: { blob: Blob; report: ValidationReport };
      if (isGif) {
        res = await convertGifToWebM(file, options, (p, stage) => {
          setProgress(p);
          setProgressStage(stage);
        });
      } else {
        res = await convertVideoToWebM(file, options, (p, stage) => {
          setProgress(p);
          setProgressStage(stage);
        });
      }

      setOutputBlob(res.blob);
      const url = URL.createObjectURL(res.blob);
      setOutputUrl(url);
      setValidationReport(res.report);

      // Automatically switch preview to display the processed result
      setActivePreviewTab('result');

      if (res.report.isValid) {
        confetti({
          particleCount: 60,
          spread: 60,
          origin: { y: 0.75 },
        });
      }
    } catch (err: unknown) {
      console.error('Conversion failed:', err);
      setErrorMsg((err as Error).message || 'Conversion failed. Please try a different video or lower framerate.');
    } finally {
      setIsConverting(false);
    }
  };

  // Download converted WebM
  const handleDownload = () => {
    if (!outputBlob) return;
    const a = document.createElement('a');
    a.href = outputUrl || URL.createObjectURL(outputBlob);
    const baseName = file ? file.name.replace(/\.[^/.]+$/, '') : 'sticker';
    a.download = `${baseName}_sticker.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Dimensions computation
  const currentDims = calculateDimensions(origWidth, origHeight, mode, crop);
  const fullDims = calculateDimensions(origWidth, origHeight, 'fit', { x: 0, y: 0, width: 1, height: 1 });
  const isCropped = crop.x > 0 || crop.y > 0 || crop.width < 0.999 || crop.height < 0.999;

  // Auto clean up URLs
  useEffect(() => {
    return () => {
      if (mediaUrl) URL.revokeObjectURL(mediaUrl);
      if (outputUrl) URL.revokeObjectURL(outputUrl);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 space-y-8">
        {/* Browser compatibility banner if WebCodecs unavailable */}
        {!supported && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <strong className="text-amber-950">WebCodecs API not detected:</strong> For high-speed in-browser VP9 encoding, please open this site in <strong>Google Chrome</strong>, <strong>Microsoft Edge</strong>, or a recent Chromium-based browser.
            </div>
          </div>
        )}

        {/* Hero description */}
        {!file && (
          <div className="text-center max-w-2xl mx-auto pt-4 pb-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-xs font-medium mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Compliant with Telegram @Stickers bot</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
              Transform Videos & GIFs into Telegram Video Stickers
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Auto-sizes to <strong className="text-slate-800">512px</strong>, trims to <strong className="text-slate-800">≤ 3.0s</strong>, encodes with <strong className="text-slate-800">VP9 WebM</strong>, and ensures file size stays under <strong className="text-slate-800">256 KB</strong>. Zero software installation required.
            </p>
          </div>
        )}

        {/* Upload Zone */}
        <section>
          <Dropzone
            currentFile={file}
            onFileSelect={handleFileSelect}
            onReset={handleReset}
          />
        </section>

        {/* Main Workspace when file loaded */}
        {file && (
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 items-start">
            {/* Top on Mobile (order-1), Right Side on Desktop (lg:order-2 lg:col-span-5) */}
            <div className="w-full order-1 lg:order-2 lg:col-span-5 space-y-5 lg:sticky lg:top-6">
              <PreviewChatMockup
                sourceUrl={mediaUrl}
                outputUrl={outputUrl}
                activeTab={activePreviewTab}
                onTabChange={setActivePreviewTab}
                startTime={startTime}
                endTime={endTime}
                scrubTime={scrubTime}
                dimensions={{
                  width: currentDims.canvasWidth,
                  height: currentDims.canvasHeight,
                }}
                crop={crop}
                onOpenReframe={() => {
                  if (framingMode === 'full') {
                    handleSelectSquare512(true);
                  } else {
                    setModalAspectMode(framingMode === 'square512' ? '1:1' : 'free');
                    setIsReframeOpen(true);
                  }
                }}
                outputReport={validationReport}
                isGif={isGif}
                onDownload={handleDownload}
              />

              {/* Desktop-only placement of Telegram guide */}
              <div className="hidden lg:block">
                <TelegramBotGuide />
              </div>
            </div>

            {/* Below Preview on Mobile (order-2), Left Side on Desktop (lg:order-1 lg:col-span-7) */}
            <div className="w-full order-2 lg:order-1 lg:col-span-7 space-y-5">
              {/* Timeline Trimmer with scrub and range sync */}
              <TimelineTrimmer
                duration={naturalDuration}
                startTime={startTime}
                endTime={endTime}
                onRangeChange={(start, end) => {
                  setStartTime(start);
                  setEndTime(end);
                  setActivePreviewTab('source');
                }}
                onScrub={(time) => {
                  setScrubTime(time);
                  setActivePreviewTab('source');
                }}
                isGif={isGif}
                speedUpToFit={speedUpToFit}
                onToggleSpeedUp={setSpeedUpToFit}
              />

              {/* Reframing & Sizing Card (Telegram 512px Rule) */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Crop className="w-4 h-4 text-sky-600" />
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 m-0">
                        Reframing & Sizing (Telegram 512px Rule)
                      </h3>
                      <p className="text-[11px] text-slate-500 m-0">
                        Choose sticker framing style according to Telegram specifications
                      </p>
                    </div>
                  </div>

                  {framingMode !== 'full' && (
                    <button
                      type="button"
                      onClick={() => {
                        setModalAspectMode(framingMode === 'square512' ? '1:1' : 'free');
                        setIsReframeOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-sky-500/20 transition active:scale-95 cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Adjust Framing Box</span>
                    </button>
                  )}
                </div>

                {/* 3 Clear Framing Options */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Choice 1: Keep Original Full */}
                  <div
                    onClick={handleSelectFull}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                      framingMode === 'full'
                        ? 'bg-sky-50/70 border-sky-500 ring-2 ring-sky-500/20 shadow-xs'
                        : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/70 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-7 h-7 rounded-lg bg-sky-100/70 text-sky-700 flex items-center justify-center">
                          <Film className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 font-semibold shadow-2xs">
                          {fullDims.canvasWidth} × {fullDims.canvasHeight} px
                        </span>
                      </div>
                      <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <span>Keep Original Full</span>
                        {framingMode === 'full' && <Check className="w-3.5 h-3.5 text-sky-600 shrink-0" />}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        Full video with no crop. Preserves original proportions within 512px.
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                      <span className="text-slate-400">Telegram Fit</span>
                      <span className="font-medium text-sky-700">No Cropping</span>
                    </div>
                  </div>

                  {/* Choice 2: Telegram sizing 512x512 (can select framing) */}
                  <div
                    onClick={() => handleSelectSquare512(false)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                      framingMode === 'square512'
                        ? 'bg-sky-50/70 border-sky-500 ring-2 ring-sky-500/20 shadow-xs'
                        : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/70 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100/70 text-emerald-700 flex items-center justify-center">
                          <Square className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 font-semibold shadow-2xs">
                          512 × 512 px
                        </span>
                      </div>
                      <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <span>Telegram Sizing 512×512</span>
                        {framingMode === 'square512' && <Check className="w-3.5 h-3.5 text-sky-600 shrink-0" />}
                      </div>
                      <div className="inline-block mt-0.5 text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        Can select framing
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        Locked 1:1 square crop. Guarantees 512×512 sticker without black bars.
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-200/60">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectSquare512(true);
                        }}
                        className="w-full py-1.5 px-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-medium text-[11px] flex items-center justify-center gap-1 shadow-2xs transition active:scale-95 cursor-pointer"
                      >
                        <Sliders className="w-3 h-3" />
                        <span>Select Framing</span>
                      </button>
                    </div>
                  </div>

                  {/* Choice 3: Free reframing (can select framing) */}
                  <div
                    onClick={() => handleSelectFree(false)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                      framingMode === 'free'
                        ? 'bg-sky-50/70 border-sky-500 ring-2 ring-sky-500/20 shadow-xs'
                        : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/70 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-100/70 text-amber-700 flex items-center justify-center">
                          <Crop className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 font-semibold shadow-2xs">
                          {framingMode === 'free' ? `${currentDims.canvasWidth} × ${currentDims.canvasHeight} px` : 'Custom'}
                        </span>
                      </div>
                      <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <span>Free Reframing</span>
                        {framingMode === 'free' && <Check className="w-3.5 h-3.5 text-sky-600 shrink-0" />}
                      </div>
                      <div className="inline-block mt-0.5 text-[10px] text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        Can select framing
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        Custom rectangular crop box. Zoom in on any subject or aspect ratio.
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-200/60">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectFree(true);
                        }}
                        className="w-full py-1.5 px-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-medium text-[11px] flex items-center justify-center gap-1 shadow-2xs transition active:scale-95 cursor-pointer"
                      >
                        <Crop className="w-3 h-3" />
                        <span>Select Framing</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Active Framing Info Bar when cropped */}
                {isCropped && (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-sky-50/80 border border-sky-200 px-3.5 py-2.5 rounded-xl text-sky-900">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                      <span>
                        Framed Area: <strong>{Math.round(crop.width * origWidth)} × {Math.round(crop.height * origHeight)} px</strong>
                        <span className="text-slate-400 mx-1.5">➔</span>
                        Sticker Output: <strong>{currentDims.canvasWidth} × {currentDims.canvasHeight} px</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setModalAspectMode(framingMode === 'square512' ? '1:1' : 'free');
                          setIsReframeOpen(true);
                        }}
                        className="text-[11px] font-semibold text-sky-700 hover:text-sky-900 underline cursor-pointer"
                      >
                        Adjust Box
                      </button>
                      <span className="text-slate-300">•</span>
                      <button
                        type="button"
                        onClick={handleSelectFull}
                        className="text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        Reset to Full
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Framerate & Compression Settings Box (Cleaned up, no duplicate dimensions) */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Settings2 className="w-4 h-4 text-sky-600" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 m-0">Framerate & Codec Settings</h3>
                    <p className="text-[11px] text-slate-500 m-0">
                      VP9 encoding parameters to maintain fluid motion within Telegram's 256 KB limit
                    </p>
                  </div>
                </div>

                {/* Framerate & Quality Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Framerate */}
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1.5">
                      Framerate (Max 30 FPS)
                    </label>
                    <div className="flex gap-2">
                      {[30, 24, 15].map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => setFps(rate)}
                          className={`flex-1 py-1.5 rounded-lg border text-xs font-mono transition cursor-pointer ${
                            fps === rate
                              ? 'bg-sky-500 text-white font-bold border-sky-500 shadow-xs'
                              : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {rate} FPS
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Compression Quality */}
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1.5">
                      Size & Quality Target
                    </label>
                    <div className="flex gap-2">
                      {(['high', 'medium', 'low'] as const).map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setQuality(q)}
                          className={`flex-1 py-1.5 rounded-lg border text-xs capitalize transition cursor-pointer ${
                            quality === q
                              ? 'bg-sky-500 text-white font-bold border-sky-500 shadow-xs'
                              : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Conversion Trigger Button & Progress */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => handleConvert()}
                  disabled={isConverting}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-sm shadow-xl shadow-sky-500/20 flex items-center justify-center gap-2 transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isConverting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{progressStage || 'Converting...'} ({progress}%)</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      <span>Convert to Telegram Sticker (.webm)</span>
                    </>
                  )}
                </button>

                {/* Progress bar */}
                {isConverting && (
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                    <div
                      className="bg-gradient-to-r from-sky-500 to-emerald-500 h-full transition-all duration-150"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}

                {/* Error Banner */}
                {errorMsg && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </div>

              {/* Validation Result Box */}
              {validationReport && (
                <ValidationBadge
                  report={validationReport}
                  onDownload={handleDownload}
                  onRecompressEco={() => handleConvert('low')}
                  isProcessing={isConverting}
                />
              )}

              {/* Step-by-Step Telegram Guide (Mobile placement at bottom of controls) */}
              <div className="block lg:hidden pt-2">
                <TelegramBotGuide />
              </div>
            </div>
          </div>
        )}

        {/* Interactive Reframe Modal */}
        <ReframeModal
          isOpen={isReframeOpen}
          onClose={() => setIsReframeOpen(false)}
          mediaUrl={mediaUrl}
          isGif={isGif}
          crop={crop}
          onCropChange={(newCrop) => {
            setCrop(newCrop);
            setActivePreviewTab('source');
          }}
          origWidth={origWidth}
          origHeight={origHeight}
          initialAspectMode={modalAspectMode}
          onApplyMode={(appliedMode) => {
            setFramingMode(appliedMode);
          }}
        />

        {/* Feature Highlights Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8 border-t border-slate-200">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center mb-2.5">
              <Cpu className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-semibold text-slate-900 mb-1">WebCodecs Hardware Acceleration</h4>
            <p className="text-[11px] text-slate-500 leading-normal">
              Encodes VP9 frames locally in milliseconds with native browser hardware support.
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2.5">
              <Film className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-semibold text-slate-900 mb-1">Strict 256 KB & 3.0s Enforcement</h4>
            <p className="text-[11px] text-slate-500 leading-normal">
              Dynamically computes bitrates to ensure every sticker complies with Telegram's size cap.
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-2.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-semibold text-slate-900 mb-1">Interactive Reframe & Crop</h4>
            <p className="text-[11px] text-slate-500 leading-normal">
              Drag to focus on your subject and easily crop out black letterbox bars.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <p>
          Built for Telegram Video Stickers • Compliant with <code className="text-slate-700 font-mono">@Stickers</code> specifications
        </p>
      </footer>
    </div>
  );
};

export default App;
