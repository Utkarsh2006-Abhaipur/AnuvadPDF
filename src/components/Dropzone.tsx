import React, { useState, useRef } from 'react';
import { Upload, FileUp, Sparkles, AlertCircle, FileText, CheckCircle } from 'lucide-react';

interface DropzoneProps {
  onFilesAdded: (files: File[]) => void;
  onAddSampleDoc: () => void;
}

export const Dropzone: React.FC<DropzoneProps> = ({ onFilesAdded, onAddSampleDoc }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (file: File) => file.type === 'application/pdf' || file.name.endsWith('.pdf')
    );

    if (droppedFiles.length > 0) {
      onFilesAdded(droppedFiles);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files).filter(
        (file: File) => file.type === 'application/pdf' || file.name.endsWith('.pdf')
      );
      if (selectedFiles.length > 0) {
        onFilesAdded(selectedFiles);
      }
      e.target.value = '';
    }
  };

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative group cursor-pointer border-2 border-dashed rounded-2xl p-8 lg:p-12 text-center transition-all duration-200 overflow-hidden ${
          isDragging
            ? 'border-orange-500 bg-orange-500/10 scale-[1.01]'
            : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900/90'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* Ambient Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-orange-500/20 transition-all" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-amber-500/20 transition-all" />

        <div className="relative flex flex-col items-center justify-center gap-4">
          <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-850 border border-slate-700/80 shadow-xl group-hover:border-orange-500/40 group-hover:scale-105 transition-all">
            <FileUp className="w-8 h-8 text-orange-400" />
          </div>

          <div className="space-y-1.5 max-w-md">
            <h3 className="text-base font-bold text-white tracking-tight">
              Drag & Drop PDF files here, or <span className="text-orange-400 underline underline-offset-2">Browse</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Supports single or batch uploads. Translates English text to Hindi inside PDF preserving paragraph locations, font sizes, and layout.
            </p>
          </div>

          {/* Quick Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-[11px] font-medium text-slate-400">
            <span className="px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-slate-300">
              ⚡ Batch Processing
            </span>
            <span className="px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-slate-300">
              🎯 Paragraph Layout OCR
            </span>
            <span className="px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-slate-300">
              🔍 Real-time Dual Preview
            </span>
          </div>

          {/* Sample Document CTA */}
          <div className="pt-4 border-t border-slate-800/80 w-full max-w-xs flex items-center justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddSampleDoc();
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-all hover:border-amber-500/40"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Try with Sample PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
