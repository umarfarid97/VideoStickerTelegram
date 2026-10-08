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

/**
 * Calculates compliant sticker dimensions according to Telegram's 512px rule
 * Enforces even numbers for both width and height (required by VP9 codecs)
 */
export function calculateDimensions(
  origWidth: number,
  origHeight: number,
  mode: 'fit' | 'pad' | 'crop'
): DimensionInfo {
  if (mode === 'pad') {
    // 512x512 with transparent padding
    const scale = Math.min(512 / origWidth, 512 / origHeight);
    const drawWidth = Math.max(2, Math.round((origWidth * scale) / 2) * 2);
    const drawHeight = Math.max(2, Math.round((origHeight * scale) / 2) * 2);
    const drawX = Math.round((512 - drawWidth) / 2);
    const drawY = Math.round((512 - drawHeight) / 2);
    return {
      canvasWidth: 512,
      canvasHeight: 512,
      drawX,
      drawY,
      drawWidth,
      drawHeight,
    };
  } else if (mode === 'crop') {
    // 512x512 filled (centered crop)
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
      drawHeight,
    };
  } else {
    // 'fit' - Telegram spec: one side exactly 512, the other 512 or less
    let canvasWidth = 512;
    let canvasHeight = 512;
    if (origWidth >= origHeight) {
      canvasWidth = 512;
      canvasHeight = Math.max(2, Math.round(((512 * origHeight) / origWidth) / 2) * 2);
      if (canvasHeight > 512) canvasHeight = 512;
    } else {
      canvasHeight = 512;
      canvasWidth = Math.max(2, Math.round(((512 * origWidth) / origHeight) / 2) * 2);
      if (canvasWidth > 512) canvasWidth = 512;
    }
    return {
      canvasWidth,
      canvasHeight,
      drawX: 0,
      drawY: 0,
      drawWidth: canvasWidth,
      drawHeight: canvasHeight,
    };
  }
}

/**
 * Finds the best working VP9 encoder configuration.
 * Tests Level 3.1 / 4.1 first because Level 1.0 has a hard 256x144 pixel limit.
 * Also tests whether alpha: 'keep' is supported, falling back gracefully to alpha: 'discard'.
 */
async function getBestEncoderConfig(
  width: number,
  height: number,
  bitrate: number,
  fps: number,
  wantsAlpha: boolean
): Promise<{ config: VideoEncoderConfig; actualAlpha: boolean }> {
  // Level 3.1 supports up to 1280x720@30fps, easily fitting 512x512
  const candidateCodecs = [
    'vp09.00.31.08',
    'vp09.00.41.08',
    'vp09.00.30.08',
    'vp09.00.21.08',
    'vp9',
  ];

  const accelOptions: ('no-preference' | 'prefer-software')[] = [
    'no-preference',
    'prefer-software',
  ];

  // Try with alpha: 'keep' if requested
  if (wantsAlpha) {
    for (const hw of accelOptions) {
      for (const codec of candidateCodecs) {
        const candidate: VideoEncoderConfig = {
          codec,
          width,
          height,
          bitrate,
          framerate: fps,
          hardwareAcceleration: hw,
          alpha: 'keep',
        };
        try {
          const check = await VideoEncoder.isConfigSupported(candidate);
          if (check.supported) {
            return { config: candidate, actualAlpha: true };
          }
        } catch {
          // Continue testing
        }
      }
    }
  }

  // Standard safe configuration (alpha: 'discard')
  for (const hw of accelOptions) {
    for (const codec of candidateCodecs) {
      const candidate: VideoEncoderConfig = {
        codec,
        width,
        height,
        bitrate,
        framerate: fps,
        hardwareAcceleration: hw,
        alpha: 'discard',
      };
      try {
        const check = await VideoEncoder.isConfigSupported(candidate);
        if (check.supported) {
          return { config: candidate, actualAlpha: false };
        }
      } catch {
        // Continue testing
      }
    }
  }

  throw new Error(
    'No supported VP9 video encoder configuration found. Please verify that hardware/software VP9 is enabled in your browser.'
  );
}

/**
 * Accurately extracts video metadata, fixing Chromium's known Infinity duration bug on WebM files
 */
export async function getVideoMetadata(
  videoUrl: string
): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    video.onloadedmetadata = () => {
      const width = video.videoWidth || 512;
      const height = video.videoHeight || 512;

      // Check if duration is already finite and valid
      if (isFinite(video.duration) && video.duration > 0 && video.duration !== Infinity) {
        resolve({
          width,
          height,
          duration: Math.max(0.5, Math.round(video.duration * 100) / 100),
        });
        return;
      }

      // Chromium Infinity duration fix: Seek to high timestamp to force index parsing
      let resolved = false;
      const handleDurationFound = () => {
        if (resolved) return;
        resolved = true;
        video.removeEventListener('timeupdate', handleDurationFound);
        let finalDur = 3.0;
        if (isFinite(video.duration) && video.duration > 0 && video.duration !== Infinity) {
          finalDur = video.duration;
        } else if (isFinite(video.currentTime) && video.currentTime > 0) {
          finalDur = video.currentTime;
        }
        video.currentTime = 0;
        resolve({
          width,
          height,
          duration: Math.max(0.5, Math.min(86400, Math.round(finalDur * 100) / 100)),
        });
      };

      video.addEventListener('timeupdate', handleDurationFound, { once: true });
      video.currentTime = 1e101;

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          video.removeEventListener('timeupdate', handleDurationFound);
          const fallback =
            isFinite(video.duration) && video.duration > 0 && video.duration !== Infinity
              ? video.duration
              : 3.0;
          video.currentTime = 0;
          resolve({
            width,
            height,
            duration: Math.max(0.5, Math.min(86400, Math.round(fallback * 100) / 100)),
          });
        }
      }, 600);
    };

    video.onerror = () => reject(new Error('Failed to load video metadata.'));
  });
}

export interface ProgressCallback {
  (progress: number, stage: string): void;
}

/**
 * Converts a Video File to Telegram Sticker WebM with smooth, non-stuttering frame capture
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

  // Attach video to DOM off-screen: Critical in Chromium to force GPU compositor to update textures on seek
  video.style.position = 'fixed';
  video.style.top = '0';
  video.style.left = '-9999px';
  video.style.width = '256px';
  video.style.height = '256px';
  video.style.opacity = '0.01';
  video.style.pointerEvents = 'none';
  document.body.appendChild(video);

  try {
    const meta = await getVideoMetadata(videoUrl);
    const duration = meta.duration;

    const start = Math.max(0, Math.min(options.startTime, duration));
    const maxEnd = Math.min(duration, start + 3.0);
    const end = Math.min(Math.max(start + 0.1, options.endTime), maxEnd);
    const segmentDuration = Math.max(0.1, end - start);

    const dims = calculateDimensions(meta.width, meta.height, options.mode);
    const fps = Math.min(30, Math.max(10, options.fps || 30));

    // Target bitrate strictly under 256 KB
    let targetBytes = 210 * 1024;
    if (options.quality === 'high') targetBytes = 230 * 1024;
    if (options.quality === 'low') targetBytes = 150 * 1024;

    const targetBitrate = Math.max(80_000, Math.floor((targetBytes * 8) / segmentDuration));

    const wantsAlpha = options.mode === 'pad';
    const { config: encoderConfig, actualAlpha } = await getBestEncoderConfig(
      dims.canvasWidth,
      dims.canvasHeight,
      targetBitrate,
      fps,
      wantsAlpha
    );

    const canvas = document.createElement('canvas');
    canvas.width = dims.canvasWidth;
    canvas.height = dims.canvasHeight;
    const ctx = canvas.getContext('2d', { alpha: actualAlpha, willReadFrequently: true });
    if (!ctx) throw new Error('Could not create 2D canvas context.');

    const target = new ArrayBufferTarget();
    const muxer = new Muxer({
      target,
      video: {
        codec: 'V_VP9',
        width: dims.canvasWidth,
        height: dims.canvasHeight,
        frameRate: fps,
        alpha: actualAlpha,
      },
      firstTimestampBehavior: 'offset',
    });

    let encoderError: any = null;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (err) => {
        encoderError = err;
        console.error('VideoEncoder error callback:', err);
      },
    });

    encoder.configure(encoderConfig);

    const totalFrames = Math.max(1, Math.round(segmentDuration * fps));
    const timeStep = segmentDuration / totalFrames;

    onProgress?.(15, 'Extracting and encoding smooth frames...');

    for (let i = 0; i < totalFrames; i++) {
      if (encoderError) {
        throw new Error(`Video encoding failed: ${encoderError.message || encoderError}`);
      }

      if (encoder.state === 'closed') {
        throw new Error(`VideoEncoder closed prematurely on frame ${i + 1}/${totalFrames}.`);
      }

      while (encoder.encodeQueueSize > 4) {
        await new Promise((r) => setTimeout(r, 10));
      }

      const currentTime = start + i * timeStep;

      // Seek with synchronized compositor paint
      await new Promise<void>((resolve) => {
        let isDone = false;
        const finish = () => {
          if (!isDone) {
            isDone = true;
            resolve();
          }
        };

        if ('requestVideoFrameCallback' in video) {
          (video as any).requestVideoFrameCallback(() => {
            finish();
          });
        }

        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          // 30ms render cushion guarantees GPU texture upload before canvas drawImage
          setTimeout(finish, 30);
        };

        video.addEventListener('seeked', onSeeked, { once: true });
        video.currentTime = currentTime;
      });

      // Clear canvas
      ctx.clearRect(0, 0, dims.canvasWidth, dims.canvasHeight);

      if (!actualAlpha && options.mode === 'pad') {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, dims.canvasWidth, dims.canvasHeight);
      }

      // Draw cleanly rendered video frame
      ctx.drawImage(
        video,
        0,
        0,
        video.videoWidth || meta.width,
        video.videoHeight || meta.height,
        dims.drawX,
        dims.drawY,
        dims.drawWidth,
        dims.drawHeight
      );

      const timestampMicroseconds = Math.round(i * (1_000_000 / fps));
      const durationMicroseconds = Math.round(1_000_000 / fps);

      const videoFrame = new VideoFrame(canvas, {
        timestamp: timestampMicroseconds,
        duration: durationMicroseconds,
        alpha: actualAlpha ? 'keep' : 'discard',
      });

      try {
        // Keyframe every 15 frames for fluid looping
        const isKeyframe = i === 0 || i % 15 === 0;
        encoder.encode(videoFrame, { keyFrame: isKeyframe });
      } finally {
        videoFrame.close();
      }

      const progressPercent = Math.round(15 + (i / totalFrames) * 75);
      onProgress?.(progressPercent, `Encoding frame ${i + 1}/${totalFrames}`);
    }

    onProgress?.(92, 'Finalizing WebM container...');

    if (encoder.state !== 'closed') {
      await encoder.flush();
      encoder.close();
    }
    muxer.finalize();

    const buffer = target.buffer;
    const blob = new Blob([buffer], { type: 'video/webm' });

    onProgress?.(100, 'Complete!');

    const report = generateValidationReport(
      blob,
      segmentDuration,
      dims.canvasWidth,
      dims.canvasHeight,
      fps,
      encoderConfig.codec
    );
    return { blob, report };
  } finally {
    video.remove();
    URL.revokeObjectURL(videoUrl);
  }
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

  let naturalDuration = rawFrames.reduce((acc, f) => acc + (f.delay || 100), 0) / 1000;
  if (naturalDuration <= 0) naturalDuration = rawFrames.length * 0.1;

  let effectiveDuration = naturalDuration;
  let timeScale = 1;

  if (options.speedUpToFit && naturalDuration > 3.0) {
    timeScale = 2.95 / naturalDuration;
    effectiveDuration = 2.95;
  } else {
    effectiveDuration = Math.min(3.0, naturalDuration);
  }

  const fps = Math.min(30, Math.max(10, options.fps || 30));
  const totalFramesToOutput = Math.max(1, Math.round(effectiveDuration * fps));

  let targetBytes = 210 * 1024;
  if (options.quality === 'high') targetBytes = 230 * 1024;
  if (options.quality === 'low') targetBytes = 150 * 1024;
  const targetBitrate = Math.max(80_000, Math.floor((targetBytes * 8) / effectiveDuration));

  // Determine best encoder configuration
  const { config: encoderConfig, actualAlpha } = await getBestEncoderConfig(
    dims.canvasWidth,
    dims.canvasHeight,
    targetBitrate,
    fps,
    true // GIFs often have transparent pixels
  );

  // Setup compositing canvas for GIF
  const compCanvas = document.createElement('canvas');
  compCanvas.width = gifWidth;
  compCanvas.height = gifHeight;
  const compCtx = compCanvas.getContext('2d', { willReadFrequently: true });
  if (!compCtx) throw new Error('Failed to create GIF composite context.');

  const patchCanvas = document.createElement('canvas');
  const patchCtx = patchCanvas.getContext('2d', { willReadFrequently: true });

  onProgress?.(15, 'Compositing GIF frames...');
  const compositedFrames: { canvas: HTMLCanvasElement; timestampSec: number }[] = [];
  let currentTimestamp = 0;

  for (let i = 0; i < rawFrames.length; i++) {
    const frame = rawFrames[i];
    const frameDelaySec = ((frame.delay || 100) / 1000) * (options.speedUpToFit ? timeScale : 1);

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

    const frameSnap = document.createElement('canvas');
    frameSnap.width = gifWidth;
    frameSnap.height = gifHeight;
    const snapCtx = frameSnap.getContext('2d');
    snapCtx?.drawImage(compCanvas, 0, 0);

    compositedFrames.push({
      canvas: frameSnap,
      timestampSec: currentTimestamp,
    });

    currentTimestamp += frameDelaySec;

    if (frame.disposalType === 2) {
      compCtx.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height);
    }
  }

  // Setup destination canvas
  const canvas = document.createElement('canvas');
  canvas.width = dims.canvasWidth;
  canvas.height = dims.canvasHeight;
  const ctx = canvas.getContext('2d', { alpha: actualAlpha, willReadFrequently: true });
  if (!ctx) throw new Error('Could not create output canvas context.');

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: 'V_VP9',
      width: dims.canvasWidth,
      height: dims.canvasHeight,
      frameRate: fps,
      alpha: actualAlpha,
    },
    firstTimestampBehavior: 'offset',
  });

  let encoderError: any = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (err) => {
      encoderError = err;
      console.error('VideoEncoder error callback:', err);
    },
  });

  encoder.configure(encoderConfig);

  onProgress?.(30, 'Encoding frames into WebM (VP9)...');

  for (let i = 0; i < totalFramesToOutput; i++) {
    if (encoderError) {
      throw new Error(`GIF encoding failed: ${encoderError.message || encoderError}`);
    }

    if (encoder.state === 'closed') {
      throw new Error(`VideoEncoder closed prematurely on frame ${i + 1}/${totalFramesToOutput}.`);
    }

    while (encoder.encodeQueueSize > 4) {
      await new Promise((r) => setTimeout(r, 10));
    }

    const targetTimeSec = (i / totalFramesToOutput) * effectiveDuration;

    let chosen = compositedFrames[0].canvas;
    for (let f = 0; f < compositedFrames.length; f++) {
      if (compositedFrames[f].timestampSec <= targetTimeSec) {
        chosen = compositedFrames[f].canvas;
      } else {
        break;
      }
    }

    ctx.clearRect(0, 0, dims.canvasWidth, dims.canvasHeight);

    if (!actualAlpha && options.mode === 'pad') {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, dims.canvasWidth, dims.canvasHeight);
    }

    ctx.drawImage(
      chosen,
      0,
      0,
      gifWidth,
      gifHeight,
      dims.drawX,
      dims.drawY,
      dims.drawWidth,
      dims.drawHeight
    );

    const timestampMicroseconds = Math.round(i * (1_000_000 / fps));
    const durationMicroseconds = Math.round(1_000_000 / fps);

    const videoFrame = new VideoFrame(canvas, {
      timestamp: timestampMicroseconds,
      duration: durationMicroseconds,
      alpha: actualAlpha ? 'keep' : 'discard',
    });

    try {
      const isKeyframe = i % 30 === 0;
      encoder.encode(videoFrame, { keyFrame: isKeyframe });
    } finally {
      videoFrame.close();
    }

    const progressPercent = Math.round(30 + (i / totalFramesToOutput) * 60);
    onProgress?.(progressPercent, `Encoding frame ${i + 1}/${totalFramesToOutput}`);
  }

  onProgress?.(94, 'Finalizing WebM container...');

  if (encoder.state !== 'closed') {
    await encoder.flush();
    encoder.close();
  }
  muxer.finalize();

  const buffer = target.buffer;
  const blob = new Blob([buffer], { type: 'video/webm' });

  onProgress?.(100, 'Complete!');

  const report = generateValidationReport(
    blob,
    effectiveDuration,
    dims.canvasWidth,
    dims.canvasHeight,
    fps,
    encoderConfig.codec
  );
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
  const isDurationValid = durationSeconds <= 3.05;
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
    warnings,
  };
}
