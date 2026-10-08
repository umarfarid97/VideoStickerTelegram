import React, { useRef, useState } from 'react';
import { UploadCloud, Film, Image as ImageIcon, Sparkles, FileVideo, RefreshCw } from 'lucide-react';
import { createDemoVideoFile } from '../utils/demoGenerator';

interface DropzoneProps {
  currentFile: File | null;
  onFileSelect: (file: File) => void;
  onReset: () => void;
}

export const Dropzone: React.FC<DropzoneProps> = ({ currentFile, onFileSelect, onReset }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      validateAndPass(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      validateAndPass(file);
    }
  };

  const validateAndPass = (file: File) => {
    const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(file.name);
    const isGif = file.type === 'image/gif' || /\.gif$/i.test(file.name);

    if (!isVideo && !isGif) {
      alert('Please upload a video file (.mp4, .webm, .mov) or animated GIF (.gif).');
      return;
    }
    onFileSelect(file);
  };

  const handleTryDemo = async () => {
    setIsGeneratingDemo(true);
    try {
      const demoFile = await createDemoVideoFile();
      onFileSelect(demoFile);
    } catch (err) {
      console.error(err);
      alert('Could not generate sample animation.');
    } finally {
      setIsGeneratingDemo(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,image/gif"
        className="hidden"
        onChange={handleFileInput}
      />

      {!currentFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? 'border-sky-500 bg-sky-50 scale-[1.01]'
              : 'border-slate-300 hover:border-sky-400 bg-white hover:bg-slate-50/80 shadow-xs'
          }`}
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-sky-500/10 to-blue-500/10 border border-sky-500/20 flex items-center justify-center text-sky-600 shadow-xs">
            <UploadCloud className="w-8 h-8" />
          </div>

          <h3 className="text-lg font-semibold text-slate-900 mb-1">
            Drop your video or animated GIF here
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-5">
            Supports MP4, WebM, MOV, and GIF. Everything converts in your browser with zero server uploads.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-medium text-xs flex items-center gap-2 shadow-md shadow-sky-500/20 transition active:scale-95 cursor-pointer"
            >
              <FileVideo className="w-4 h-4" />
              <span>Browse File</span>
            </button>

            <button
              type="button"
              disabled={isGeneratingDemo}
              onClick={(e) => {
                e.stopPropagation();
                handleTryDemo();
              }}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium text-xs flex items-center gap-2 transition active:scale-95 disabled:opacity-50 shadow-xs cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>{isGeneratingDemo ? 'Generating demo...' : 'Try Demo Sticker'}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-12 h-12 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shrink-0">
              {currentFile.type.startsWith('image/gif') ? (
                <ImageIcon className="w-6 h-6" />
              ) : (
                <Film className="w-6 h-6" />
              )}
            </div>
            <div className="truncate text-left flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-slate-900 truncate block">
                  {currentFile.name}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                  {currentFile.type.startsWith('image/gif') ? 'GIF' : 'VIDEO'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Original file size: <span className="text-slate-700 font-mono">{formatSize(currentFile.size)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Change File</span>
            </button>
            <button
              onClick={onReset}
              className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-medium transition cursor-pointer"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
