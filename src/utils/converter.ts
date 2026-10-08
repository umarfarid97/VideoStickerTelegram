import { Muxer, ArrayBufferTarget } from 'webm-muxer';
import { parseGIF, decompressFrames } from 'gifuct-js';

export interface StickerOptions {
  mode: 'fit' | 'pad' | 'crop';
  startTime: number;
  endTime: number;
  fps: number;
  quality: 'high' | 'medium' | 'low';
  speedUpToFit: boolean;
  loopPlayback: boolean;
}

export interface DimensionInfo {
  canvasWidth: number;
  canvasHeight: number;
  drawX: number;
  drawY: number;
  drawWidth: number;
  drawHeight: number;
}

export interface ValidationReport {
  isValid: boolean;
  sizeBytes: number;
  sizeKB: number;
  isSizeValid: boolean; // <= 256 KB
  durationSeconds: number;
  isDurationValid: boolean; // <= 3.0s
  dimensions: { width: number; height: number };
  isDimensionsValid: boolean; // one side 512, other <= 512
  fps: number;
  isFpsValid: boolean; // <= 30
  codec: string;
  hasAudio: boolean; // must be false
  errors: string[];
  warnings: string[];
}

export function isWebCodecsSupported(): boolean {
  return typeof window !== 'undefined' && typeof VideoEncoder !== 'undefined';
}

export function calculateDimensions(
  origWidth: number,
  origHeight: number,
  mode: 'fit' | 'pad' | 'crop'
): DimensionInfo {
  if (mode === 'pad') {
    // 512x512 with transparent letterbox/pillarbox
    const scale = Math.min(512 / origWidth, 512 / origHeight);
    const drawWidth = Math.max(2, Math.round(origWidth * scale / 2) * 2);
    const drawHeight = Math.max(2, Math.round(origHeight * scale / 2) * 2);
    const drawX = Math.round((512 - drawWidth) / 2);
    const drawY = Math.round((512 - drawHeight) / 2);
    return {
      canvasWidth: 512,
      canvasHeight: 512,
      drawX,
      drawY,
      drawWidth,
      drawHeight
    };
  } else if (mode === 'crop') {
    // 512x512 filled (cropped centered)
    const scale = Math.max(512 / origWidth, 512 / origHeight);
    const drawWidth = Math.round(origWidth * scale);
    const drawHeight = Math.round(origHeight * scale);
    const drawX = Math.round((512 - drawWidth) / 2);
    const drawY = Math.round((512 - drawHeight) / 2);
    return {
      canvasWidth: 512,
      canvasHeight: 512,
      drawX,
      drawY,
      drawWidth,
      drawHeight
    };
  } else {
    // 'fit' - Telegram spec: one side exactly 512, the other 512 or less
    let canvasWidth = 512;
    let canvasHeight = 512;
    if (origWidth >= origHeight) {
      canvasWidth = 512;
      canvasHeight = Math.max(2, Math.round((512 * origHeight / origWidth) / 2) * 2);
    } else {
      canvasHeight = 512;
      canvasWidth = Math.max(2, Math.round((512 * origWidth / origHeight) / 2) * 2);
    }
    return {
      canvasWidth,
      canvasHeight,
      drawX: 0,
      drawY: 0,
      drawWidth: canvasWidth,
      drawHeight: canvasHeight
    };
  }
}

async function findSupportedVp9Codec(width: number, height: number, bitrate: number, fps: number): Promise<string> {
  const candidates = [
    'vp09.00.10.08',
    'vp09.00.41.08',
    'vp09.02.10.10',
    'vp9'
  ];

  for (const codec of candidates) {
    try {
      const config = {
        codec,
        width,
        height,
        bitrate,
        framerate: fps
      };
      const check = await VideoEncoder.isConfigSupported(config);
      if (check.supported) {
        return codec;
      }
    } catch {
      // Continue testing
    }
  }

  throw new Error('Your browser does not support VP9 video encoding via WebCodecs. Please try Google Chrome, Microsoft Edge, or a modern Chromium browser.');
}

export interface ProgressCallback {
  (progress: number, stage: string): void;
}

/**
 * Converts a Video File to Telegram Sticker WebM
 */
export async function convertVideoToWebM(
  videoFile: File,
  options: StickerOptions,
  onProgress?: ProgressCallback
): Promise<{ blob: Blob; report: ValidationReport }> {
  if (!isWebCodecsSupported()) {
    throw new Error('WebCodecs is not supported in this browser.');
  }

  onProgress?.(5, 'Loading video...');
  const videoUrl = URL.createObjectURL(videoFile);
  const video = document.createElement('video');
  video.src = videoUrl;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Failed to load video file.'));
  });

  const duration = video.duration || 3.0;
  const start = Math.max(0, Math.min(options.startTime, duration));
  const maxEnd = Math.min(duration, start + 3.0);
  const end = Math.min(Math.max(start + 0.1, options.endTime), maxEnd);
  const segmentDuration = end - start;

  const dims = calculateDimensions(video.videoWidth, video.videoHeight, options.mode);
  const fps = Math.min(30, Math.max(10, options.fps || 30));

  // Determine bitrate based on quality and duration to guarantee < 256 KB
  // Telegram limit is 256 KB (262,144 bytes).
  // Target safe size: ~200 KB = 1,600,000 bits.
  let targetBytes = 210 * 1024;
  if (options.quality === 'high') targetBytes = 235 * 1024;
  if (options.quality === 'low') targetBytes = 160 * 1024;

  const targetBitrate = Math.max(100_000, Math.floor((targetBytes * 8) / segmentDuration));

  const codec = await findSupportedVp9Codec(dims.canvasWidth, dims.canvasHeight, targetBitrate, fps);

  // Setup offscreen canvas
  const canvas = document.createElement('canvas');
  canvas.width = dims.canvasWidth;
  canvas.height = dims.canvasHeight;
  const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
  if (!ctx) throw new Error('Could not create 2D canvas context.');

  const target = new ArrayBufferTarget();
  const hasAlpha = options.mode === 'pad'; // Pad mode has transparent padding

  const muxer = new Muxer({
    target,
    video: {
      codec: 'V_VP9',
      width: dims.canvasWidth,
      height: dims.canvasHeight,
      frameRate: fps,
      alpha: hasAlpha
    },
    firstTimestampBehavior: 'offset'
  });

  let encoderError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (err) => {
      encoderError = err;
      console.error('Encoder error:', err);
    }
  });

  await encoder.configure({
    codec,
    width: dims.canvasWidth,
    height: dims.canvasHeight,
    bitrate: targetBitrate,
    framerate: fps,
    alpha: hasAlpha ? 'keep' : 'discard',
    bitrateMode: 'variable',
    latencyMode: 'quality'
  });

  const totalFrames = Math.max(1, Math.round(segmentDuration * fps));
  const timeStep = segmentDuration / totalFrames;

  onProgress?.(15, 'Encoding frames...');

  for (let i = 0; i < totalFrames; i++) {
    if (encoderError) throw encoderError;

    const currentTime = start + i * timeStep;
    video.currentTime = currentTime;

    await new Promise<void>((resolve) => {
      const handleSeek = () => {
        video.removeEventListener('seeked', handleSeek);
        resolve();
      };
      video.addEventListener('seeked', handleSeek, { once: true });
    });

    // Clear canvas (ensures transparent background if padded)
    ctx.clearRect(0, 0, dims.canvasWidth, dims.canvasHeight);

    // Draw current frame scaled to destination
    ctx.drawImage(
      video,
      0, 0, video.videoWidth, video.videoHeight,
      dims.drawX, dims.drawY, dims.drawWidth, dims.drawHeight
    );

    const timestampMicroseconds = Math.round(i * (1_000_000 / fps));
    const durationMicroseconds = Math.round(1_000_000 / fps);

    const videoFrame = new VideoFrame(canvas, {
      timestamp: timestampMicroseconds,
      duration: durationMicroseconds,
      alpha: hasAlpha ? 'keep' : 'discard'
    });

    const isKeyframe = i % 30 === 0;
    encoder.encode(videoFrame, { keyFrame: isKeyframe });
    videoFrame.close();

    const progressPercent = Math.round(15 + (i / totalFrames) * 75);
    onProgress?.(progressPercent, `Processing frame ${i + 1}/${totalFrames}`);
  }

  onProgress?.(92, 'Finalizing WebM container...');
  await encoder.flush();
  encoder.close();
  muxer.finalize();
  URL.revokeObjectURL(videoUrl);

  const buffer = target.buffer;
  const blob = new Blob([buffer], { type: 'video/webm' });

  onProgress?.(100, 'Complete!');

  const report = generateValidationReport(blob, segmentDuration, dims.canvasWidth, dims.canvasHeight, fps, codec);
  return { blob, report };
}

/**
 * Converts an Animated GIF to Telegram Sticker WebM
 */
export async function convertGifToWebM(
  gifFile: File,
  options: StickerOptions,
  onProgress?: ProgressCallback
): Promise<{ blob: Blob; report: ValidationReport }> {
  if (!isWebCodecsSupported()) {
    throw new Error('WebCodecs is not supported in this browser.');
  }

  onProgress?.(5, 'Parsing GIF file...');
  const arrayBuffer = await gifFile.arrayBuffer();
  const parsedGif = parseGIF(arrayBuffer);
  const rawFrames = decompressFrames(parsedGif, true);

  if (!rawFrames || rawFrames.length === 0) {
    throw new Error('No animation frames found in the GIF.');
  }

  const gifWidth = parsedGif.lsd.width;
  const gifHeight = parsedGif.lsd.height;
  const dims = calculateDimensions(gifWidth, gifHeight, options.mode);

  // Calculate natural GIF duration
  let naturalDuration = rawFrames.reduce((acc, f) => acc + (f.delay || 100), 0) / 1000;
  if (naturalDuration <= 0) naturalDuration = rawFrames.length * 0.1;

  let effectiveDuration = naturalDuration;
  let timeScale = 1;

  if (options.speedUpToFit && naturalDuration > 3.0) {
    // Compress time so entire animation fits in <= 3.0s
    timeScale = 2.95 / naturalDuration;
    effectiveDuration = 2.95;
  } else {
    // Clamp to 3.0s window
    effectiveDuration = Math.min(3.0, naturalDuration);
  }

  const fps = Math.min(30, Math.max(10, options.fps || 30));
  const totalFramesToOutput = Math.max(1, Math.round(effectiveDuration * fps));

  let targetBytes = 210 * 1024;
  if (options.quality === 'high') targetBytes = 235 * 1024;
  if (options.quality === 'low') targetBytes = 160 * 1024;
  const targetBitrate = Math.max(100_000, Math.floor((targetBytes * 8) / effectiveDuration));

  const codec = await findSupportedVp9Codec(dims.canvasWidth, dims.canvasHeight, targetBitrate, fps);

  // Setup compositing canvas for GIF
  const compCanvas = document.createElement('canvas');
  compCanvas.width = gifWidth;
  compCanvas.height = gifHeight;
  const compCtx = compCanvas.getContext('2d', { willReadFrequently: true });
  if (!compCtx) throw new Error('Failed to create GIF composite context.');

  const patchCanvas = document.createElement('canvas');
  const patchCtx = patchCanvas.getContext('2d', { willReadFrequently: true });

  // Pre-composite all GIF frames to full frames
  onProgress?.(15, 'Compositing GIF frames...');
  const compositedFrames: { canvas: HTMLCanvasElement; timestampSec: number }[] = [];
  let currentTimestamp = 0;

  for (let i = 0; i < rawFrames.length; i++) {
    const frame = rawFrames[i];
    const frameDelaySec = ((frame.delay || 100) / 1000) * (options.speedUpToFit ? timeScale : 1);

    // Prepare patch
    if (frame.dims.width > 0 && frame.dims.height > 0) {
      patchCanvas.width = frame.dims.width;
      patchCanvas.height = frame.dims.height;
      const imgData = patchCtx?.createImageData(frame.dims.width, frame.dims.height);
      if (imgData) {
        imgData.data.set(frame.patch);
        patchCtx?.putImageData(imgData, 0, 0);
        compCtx.drawImage(patchCanvas, frame.dims.left, frame.dims.top);
      }
    }

    // Save frame snapshot
    const frameSnap = document.createElement('canvas');
    frameSnap.width = gifWidth;
    frameSnap.height = gifHeight;
    const snapCtx = frameSnap.getContext('2d');
    snapCtx?.drawImage(compCanvas, 0, 0);

    compositedFrames.push({
      canvas: frameSnap,
      timestampSec: currentTimestamp
    });

    currentTimestamp += frameDelaySec;

    // Handle disposal
    if (frame.disposalType === 2) {
      compCtx.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height);
    }
  }

  // Setup destination canvas
  const canvas = document.createElement('canvas');
  canvas.width = dims.canvasWidth;
  canvas.height = dims.canvasHeight;
  const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
  if (!ctx) throw new Error('Could not create output canvas context.');

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: 'V_VP9',
      width: dims.canvasWidth,
      height: dims.canvasHeight,
      frameRate: fps,
      alpha: true // GIFs often have transparent areas
    },
    firstTimestampBehavior: 'offset'
  });

  let encoderError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (err) => {
      encoderError = err;
      console.error('Encoder error:', err);
    }
  });

  await encoder.configure({
    codec,
    width: dims.canvasWidth,
    height: dims.canvasHeight,
    bitrate: targetBitrate,
    framerate: fps,
    alpha: 'keep',
    bitrateMode: 'variable',
    latencyMode: 'quality'
  });

  onProgress?.(30, 'Encoding frames into WebM (VP9)...');

  for (let i = 0; i < totalFramesToOutput; i++) {
    if (encoderError) throw encoderError;

    const targetTimeSec = (i / totalFramesToOutput) * effectiveDuration;

    // Find closest composited frame
    let chosen = compositedFrames[0].canvas;
    for (let f = 0; f < compositedFrames.length; f++) {
      if (compositedFrames[f].timestampSec <= targetTimeSec) {
        chosen = compositedFrames[f].canvas;
      } else {
        break;
      }
    }

    ctx.clearRect(0, 0, dims.canvasWidth, dims.canvasHeight);
    ctx.drawImage(
      chosen,
      0, 0, gifWidth, gifHeight,
      dims.drawX, dims.drawY, dims.drawWidth, dims.drawHeight
    );

    const timestampMicroseconds = Math.round(i * (1_000_000 / fps));
    const durationMicroseconds = Math.round(1_000_000 / fps);

    const videoFrame = new VideoFrame(canvas, {
      timestamp: timestampMicroseconds,
      duration: durationMicroseconds,
      alpha: 'keep'
    });

    const isKeyframe = i % 30 === 0;
    encoder.encode(videoFrame, { keyFrame: isKeyframe });
    videoFrame.close();

    const progressPercent = Math.round(30 + (i / totalFramesToOutput) * 60);
    onProgress?.(progressPercent, `Encoding frame ${i + 1}/${totalFramesToOutput}`);
  }

  onProgress?.(94, 'Finalizing WebM container...');
  await encoder.flush();
  encoder.close();
  muxer.finalize();

  const buffer = target.buffer;
  const blob = new Blob([buffer], { type: 'video/webm' });

  onProgress?.(100, 'Complete!');

  const report = generateValidationReport(blob, effectiveDuration, dims.canvasWidth, dims.canvasHeight, fps, codec);
  return { blob, report };
}

function generateValidationReport(
  blob: Blob,
  duration: number,
  width: number,
  height: number,
  fps: number,
  codec: string
): ValidationReport {
  const sizeBytes = blob.size;
  const sizeKB = Math.round((sizeBytes / 1024) * 10) / 10;
  const isSizeValid = sizeBytes <= 256 * 1024;
  const durationSeconds = Math.round(duration * 100) / 100;
  const isDurationValid = durationSeconds <= 3.05; // 3.0s with tiny tolerance
  const isDimensionsValid = (width === 512 && height <= 512) || (height === 512 && width <= 512);
  const isFpsValid = fps <= 30;

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isSizeValid) {
    errors.push(`File size (${sizeKB} KB) exceeds Telegram limit of 256 KB.`);
  } else if (sizeKB > 240) {
    warnings.push(`File size (${sizeKB} KB) is close to the 256 KB limit.`);
  }

  if (!isDurationValid) {
    errors.push(`Duration (${durationSeconds}s) exceeds Telegram limit of 3.0s.`);
  }

  if (!isDimensionsValid) {
    errors.push(`Dimensions (${width}x${height}) do not comply. One side must be 512px, the other <= 512px.`);
  }

  if (!isFpsValid) {
    errors.push(`Framerate (${fps} FPS) exceeds Telegram limit of 30 FPS.`);
  }

  const isValid = isSizeValid && isDurationValid && isDimensionsValid && isFpsValid;

  return {
    isValid,
    sizeBytes,
    sizeKB,
    isSizeValid,
    durationSeconds,
    isDurationValid,
    dimensions: { width, height },
    isDimensionsValid,
    fps,
    isFpsValid,
    codec,
    hasAudio: false,
    errors,
    warnings
  };
}
