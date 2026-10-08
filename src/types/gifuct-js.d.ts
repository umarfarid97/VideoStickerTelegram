declare module 'gifuct-js' {
  export interface ParsedFrame {
    dims: {
      top: number;
      left: number;
      width: number;
      height: number;
    };
    patch: Uint8ClampedArray;
    delay: number;
    disposalType: number;
    transparentIndex: number;
  }

  export interface ParsedGif {
    frames: ParsedFrame[];
    lsd: {
      width: number;
      height: number;
    };
  }

  export function parseGIF(buffer: ArrayBuffer): ParsedGif;
  export function decompressFrames(gif: ParsedGif, buildPatch: boolean): ParsedFrame[];
  export function decompressFrame(frame: ParsedFrame, gif: ParsedGif, buildPatch: boolean): ParsedFrame;
}
