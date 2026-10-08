import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Sparkles,
  Settings2,
  Maximize2,
  Cpu,
  Loader2,
  AlertCircle,
  Film,
  Zap,
  Crop,
  Sliders,
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

export const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isGif, setIsGif] = useState<boolean>(false);

  // Metadata
  const [naturalDuration, setNaturalDuration] = useState<number>(3.0);
  const [origWidth, setOrigWidth] = useState<number>(512);
  const [origHeight, setOrigHeight] = useState<number>(512);

  // Options
  const [mode, setMode] = useState<'fit' | 'pad' | 'crop'>('fit');
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(3.0);
  const [fps, setFps] = useState<number>(30);
  const [quality, setQuality] = useState<'high' | 'medium' | 'low'>('medium');
  const [speedUpToFit, setSpeedUpToFit] = useState<boolean>(true);

  // Reframe & Crop Area State (0 to 1 normalized coordinates)
  const [crop, setCrop] = useState<CropArea>({ x: 0, y: 0, width: 1, height: 1 });
  const [isReframeOpen, setIsReframeOpen] = useState<boolean>(false);

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

      // Automatically switch preview to display the processed result!
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

  const currentDims = calculateDimensions(origWidth, origHeight, mode, crop);
  const isCropped = crop.x > 0 || crop.y > 0 || crop.width < 1 || crop.height < 1;

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
                onOpenReframe={() => setIsReframeOpen(true)}
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

              {/* Area Reframing & Black Bar Removal Control Box */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Crop className="w-4 h-4 text-sky-600" />
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 m-0">Area Reframing & Black Bars</h3>
                      <p className="text-[11px] text-slate-500 m-0">
                        Choose your focus subject and remove letterbox black bars
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsReframeOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-sky-500/20 transition active:scale-95 cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Select Area to Reframe</span>
                  </button>
                </div>

                {/* Black Bar Handling Modes */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-700 block">
                    Black Bar & Padding Choice
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Option 1: Remove Black Bars */}
                    <button
                      type="button"
                      onClick={() => {
                        setCrop({ x: 0, y: 0.12, width: 1, height: 0.76 });
                        setActivePreviewTab('source');
                      }}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        crop.y === 0.12 && crop.height === 0.76
                          ? 'bg-amber-50 border-amber-400 text-amber-900 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                      }`}
                    >
                      <div className="font-semibold text-xs text-slate-900 flex items-center gap-1">
                        <span>🎬 Remove Black Bars</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        Crops out top & bottom movie letterbox
                      </div>
                    </button>

                    {/* Option 2: Transparent Padding */}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('pad');
                        setCrop({ x: 0, y: 0, width: 1, height: 1 });
                        setActivePreviewTab('source');
                      }}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        mode === 'pad' && crop.width === 1 && crop.height === 1
                          ? 'bg-sky-50 border-sky-400 text-sky-900 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                      }`}
                    >
                      <div className="font-semibold text-xs text-slate-900 flex items-center gap-1">
                        <span>🫧 Transparent Padding</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        Clean transparent margins in Telegram
                      </div>
                    </button>

                    {/* Option 3: Keep Original Full Frame */}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('fit');
                        setCrop({ x: 0, y: 0, width: 1, height: 1 });
                        setActivePreviewTab('source');
                      }}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        mode === 'fit' && crop.width === 1 && crop.height === 1
                          ? 'bg-sky-50 border-sky-400 text-sky-900 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                      }`}
                    >
                      <div className="font-semibold text-xs text-slate-900 flex items-center gap-1">
                        <span>Keep Original Full</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        Keep full original video without cropping
                      </div>
                    </button>
                  </div>
                </div>

                {isCropped && (
                  <div className="flex items-center justify-between text-xs bg-sky-50 border border-sky-200 px-3 py-2 rounded-xl text-sky-800">
                    <span>
                      Active Reframe: {Math.round(crop.width * origWidth)} × {Math.round(crop.height * origHeight)} px
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCrop({ x: 0, y: 0, width: 1, height: 1 });
                        setActivePreviewTab('source');
                      }}
                      className="text-[11px] underline text-sky-700 hover:text-sky-900 font-medium cursor-pointer"
                    >
                      Reset Full Frame
                    </button>
                  </div>
                )}
              </div>

              {/* Conversion Settings Box */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Settings2 className="w-4 h-4 text-sky-600" />
                  <h3 className="text-sm font-semibold text-slate-900 m-0">Sticker Dimensions & Codec Settings</h3>
                </div>

                {/* Dimension Modes */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-700 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
                      Dimension Fitting Mode (Telegram 512px Rule)
                    </span>
                    <span className="font-mono text-sky-700 font-semibold text-[11px]">
                      {currentDims.canvasWidth} × {currentDims.canvasHeight} px
                    </span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('fit');
                        setActivePreviewTab('source');
                      }}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        mode === 'fit'
                          ? 'bg-sky-50 border-sky-500 text-sky-900 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                      }`}
                    >
                      <div className="font-semibold text-xs text-slate-900">Preserve Ratio</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Longest side 512px (Recommended)
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMode('pad');
                        setActivePreviewTab('source');
                      }}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        mode === 'pad'
                          ? 'bg-sky-50 border-sky-500 text-sky-900 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                      }`}
                    >
                      <div className="font-semibold text-xs text-slate-900">Square 512×512 Pad</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Centered with transparent margins
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMode('crop');
                        setActivePreviewTab('source');
                      }}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        mode === 'crop'
                          ? 'bg-sky-50 border-sky-500 text-sky-900 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                      }`}
                    >
                      <div className="font-semibold text-xs text-slate-900">Center Crop 512×512</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Fills entire 512×512 canvas
                      </div>
                    </button>
                  </div>
                </div>

                {/* Framerate & Quality Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
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
