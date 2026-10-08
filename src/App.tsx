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
} from 'lucide-react';
import { Header } from './components/Header';
import { Dropzone } from './components/Dropzone';
import { TimelineTrimmer } from './components/TimelineTrimmer';
import { PreviewChatMockup } from './components/PreviewChatMockup';
import { ValidationBadge } from './components/ValidationBadge';
import { TelegramBotGuide } from './components/TelegramBotGuide';
import {
  convertVideoToWebM,
  convertGifToWebM,
  isWebCodecsSupported,
  calculateDimensions,
  type StickerOptions,
  type ValidationReport,
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
        const video = document.createElement('video');
        video.src = objectUrl;
        video.muted = true;
        video.playsInline = true;

        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve();
          video.onerror = () => reject(new Error('Failed to load video metadata'));
        });

        const vWidth = video.videoWidth || 512;
        const vHeight = video.videoHeight || 512;
        const dur = video.duration || 3.0;

        setOrigWidth(vWidth);
        setOrigHeight(vHeight);
        setNaturalDuration(dur);
        setStartTime(0);
        setEndTime(Math.min(dur, 3.0));
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

  const currentDims = calculateDimensions(origWidth, origHeight, mode);

  // Auto clean up URLs
  useEffect(() => {
    return () => {
      if (mediaUrl) URL.revokeObjectURL(mediaUrl);
      if (outputUrl) URL.revokeObjectURL(outputUrl);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 space-y-8">
        {/* Browser compatibility banner if WebCodecs unavailable */}
        {!supported && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <strong className="text-amber-100">WebCodecs API not detected:</strong> For high-speed in-browser VP9 encoding, please open this site in <strong>Google Chrome</strong>, <strong>Microsoft Edge</strong>, or a recent Chromium-based browser.
            </div>
          </div>
        )}

        {/* Hero description */}
        {!file && (
          <div className="text-center max-w-2xl mx-auto pt-4 pb-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-medium mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Compliant with Telegram @Stickers bot</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
              Transform Videos & GIFs into Telegram Video Stickers
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Auto-sizes to <strong className="text-slate-200">512px</strong>, trims to <strong className="text-slate-200">≤ 3.0s</strong>, encodes with <strong className="text-slate-200">VP9 WebM</strong>, and ensures file size stays under <strong className="text-slate-200">256 KB</strong>. Zero software installation required.
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Settings, Timeline, Conversion */}
            <div className="lg:col-span-7 space-y-5">
              {/* Timeline Trimmer with scrub and range sync */}
              <TimelineTrimmer
                duration={naturalDuration}
                startTime={startTime}
                endTime={endTime}
                onRangeChange={(start, end) => {
                  setStartTime(start);
                  setEndTime(end);
                  setActivePreviewTab('source'); // Show source preview when adjusting range
                }}
                onScrub={(time) => {
                  setScrubTime(time);
                  setActivePreviewTab('source');
                }}
                isGif={isGif}
                speedUpToFit={speedUpToFit}
                onToggleSpeedUp={setSpeedUpToFit}
              />

              {/* Conversion Settings Box */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
                  <Settings2 className="w-4 h-4 text-sky-400" />
                  <h3 className="text-sm font-semibold text-white m-0">Sticker Dimensions & Codec Settings</h3>
                </div>

                {/* Dimension Modes */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
                      Dimension Fitting Mode (Telegram 512px Rule)
                    </span>
                    <span className="font-mono text-sky-400 text-[11px]">
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
                      className={`p-2.5 rounded-xl border text-left transition ${
                        mode === 'fit'
                          ? 'bg-sky-500/10 border-sky-500/40 text-white shadow-sm'
                          : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="font-semibold text-xs text-white">Preserve Ratio</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Longest side 512px (Recommended)
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMode('pad');
                        setActivePreviewTab('source');
                      }}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        mode === 'pad'
                          ? 'bg-sky-500/10 border-sky-500/40 text-white shadow-sm'
                          : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="font-semibold text-xs text-white">Square 512×512 Pad</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Centered with transparent margins
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMode('crop');
                        setActivePreviewTab('source');
                      }}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        mode === 'crop'
                          ? 'bg-sky-500/10 border-sky-500/40 text-white shadow-sm'
                          : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="font-semibold text-xs text-white">Center Crop 512×512</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Fills entire 512×512 canvas
                      </div>
                    </button>
                  </div>
                </div>

                {/* Framerate & Quality Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {/* Framerate */}
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1.5">
                      Framerate (Max 30 FPS)
                    </label>
                    <div className="flex gap-2">
                      {[30, 24, 15].map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => setFps(rate)}
                          className={`flex-1 py-1.5 rounded-lg border text-xs font-mono transition ${
                            fps === rate
                              ? 'bg-sky-500 text-white font-bold border-sky-400 shadow-sm'
                              : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:text-white'
                          }`}
                        >
                          {rate} FPS
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Compression Quality */}
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1.5">
                      Size & Quality Target
                    </label>
                    <div className="flex gap-2">
                      {(['high', 'medium', 'low'] as const).map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setQuality(q)}
                          className={`flex-1 py-1.5 rounded-lg border text-xs capitalize transition ${
                            quality === q
                              ? 'bg-sky-500 text-white font-bold border-sky-400 shadow-sm'
                              : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:text-white'
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
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-sm shadow-xl shadow-sky-500/25 flex items-center justify-center gap-2 transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                    <div
                      className="bg-gradient-to-r from-sky-500 to-emerald-400 h-full transition-all duration-150"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}

                {/* Error Banner */}
                {errorMsg && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
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
            </div>

            {/* Right Column: Unified Telegram Chat Simulation Preview */}
            <div className="lg:col-span-5 space-y-5">
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
                outputReport={validationReport}
                isGif={isGif}
                onDownload={handleDownload}
              />

              {/* Step-by-Step Telegram Guide */}
              <TelegramBotGuide />
            </div>
          </div>
        )}

        {/* Feature Highlights Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8 border-t border-slate-800/80">
          <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800/60">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center mb-2.5">
              <Cpu className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-semibold text-white mb-1">WebCodecs Hardware Acceleration</h4>
            <p className="text-[11px] text-slate-400 leading-normal">
              Encodes VP9 frames locally in milliseconds with native browser hardware support.
            </p>
          </div>

          <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800/60">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2.5">
              <Film className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-semibold text-white mb-1">Strict 256 KB & 3.0s Enforcement</h4>
            <p className="text-[11px] text-slate-400 leading-normal">
              Dynamically computes bitrates to ensure every sticker complies with Telegram's size cap.
            </p>
          </div>

          <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800/60">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center mb-2.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-semibold text-white mb-1">GitHub Pages & Static Hosting</h4>
            <p className="text-[11px] text-slate-400 leading-normal">
              100% static HTML/JS bundle with zero backend servers or secret keys needed.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        <p>
          Built for Telegram Video Stickers • Compliant with <code className="text-slate-400">@Stickers</code> specifications
        </p>
      </footer>
    </div>
  );
};

export default App;
