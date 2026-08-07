import React, { useState, useEffect, useRef } from 'react';
import { DocumentJob, ParagraphBlock } from '../types';
import { renderTranslatedPageToCanvas } from '../utils/pdfRenderer';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Columns,
  Layers,
  Edit3,
  Download,
  Sparkles,
  Type,
  Check,
} from 'lucide-react';

interface InteractivePreviewProps {
  job: DocumentJob;
  onUpdateParagraph: (pageNumber: number, blockId: string, updatedText: string, updatedFontSize?: number) => void;
  onDownloadPdf: () => void;
}

export const InteractivePreview: React.FC<InteractivePreviewProps> = ({
  job,
  onUpdateParagraph,
  onDownloadPdf,
}) => {
  const [activePageNum, setActivePageNum] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'sideBySide' | 'overlay'>('sideBySide');
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);

  // Edit State
  const [editingBlock, setEditingBlock] = useState<ParagraphBlock | null>(null);
  const [editText, setEditText] = useState<string>('');
  const [editFontSize, setEditFontSize] = useState<number>(14);

  const translatedCanvasRef = useRef<HTMLCanvasElement>(null);

  const activePageRes = job.pages.find((p) => p.pageNumber === activePageNum) || job.pages[0];

  // Render translated canvas when active page or blocks change
  useEffect(() => {
    if (activePageRes && translatedCanvasRef.current) {
      renderTranslatedPageToCanvas(activePageRes, translatedCanvasRef.current, 2.0);
    }
  }, [activePageRes, activePageNum, job]);

  if (!activePageRes) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
        No rendered pages available for preview yet.
      </div>
    );
  }

  const selectedBlock = activePageRes.blocks.find((b) => b.id === selectedBlockId);

  const handleStartEdit = (block: ParagraphBlock) => {
    setEditingBlock(block);
    setEditText(block.translatedText);
    setEditFontSize(block.adjustedFontSize || block.fontSize);
  };

  const handleSaveEdit = () => {
    if (editingBlock) {
      onUpdateParagraph(activePageNum, editingBlock.id, editText, editFontSize);
      setEditingBlock(null);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full min-h-[680px]">
      {/* Preview Header & Controls */}
      <div className="bg-slate-950 px-4 lg:px-6 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setViewMode('sideBySide')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              viewMode === 'sideBySide'
                ? 'bg-orange-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Split Side-by-Side</span>
          </button>
          <button
            onClick={() => setViewMode('overlay')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              viewMode === 'overlay'
                ? 'bg-orange-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Translated Overlay</span>
          </button>
        </div>

        {/* Page Navigation */}
        <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
          <button
            disabled={activePageNum <= 1}
            onClick={() => setActivePageNum((prev) => Math.max(prev - 1, 1))}
            className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-semibold text-slate-200">
            Page {activePageNum} of {job.pageCount}
          </span>
          <button
            disabled={activePageNum >= job.pageCount}
            onClick={() => setActivePageNum((prev) => Math.min(prev + 1, job.pageCount))}
            className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom Controls & Export */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setZoomScale((z) => Math.max(z - 0.15, 0.5))}
              className="p-1.5 rounded text-slate-400 hover:text-white transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono text-slate-300 min-w-[48px] text-center">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              onClick={() => setZoomScale((z) => Math.min(z + 0.15, 2.0))}
              className="p-1.5 rounded text-slate-400 hover:text-white transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomScale(1.0)}
              className="p-1.5 rounded text-slate-400 hover:text-white transition-colors"
              title="Reset Zoom"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={onDownloadPdf}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-semibold bg-emerald-500 hover:bg-emerald-600 text-slate-950 transition-all shadow-md shadow-emerald-500/10"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Translated PDF</span>
          </button>
        </div>
      </div>

      {/* Main Preview Workspace */}
      <div className="flex-1 bg-slate-950 overflow-auto p-6 flex justify-center items-start relative min-h-[500px]">
        <div
          className={`transition-all duration-200 ${
            viewMode === 'sideBySide' ? 'grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-6xl' : 'max-w-3xl w-full'
          }`}
          style={{ transform: `scale(${zoomScale})`, transformOrigin: 'top center' }}
        >
          {/* Side 1: Original English Document Page with Paragraph Bounding Overlays */}
          {(viewMode === 'sideBySide' || viewMode === 'overlay') && (
            <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-white shadow-2xl group">
              <div className="absolute top-2 left-2 z-10 px-2.5 py-1 rounded-md bg-slate-900/90 text-white text-[10px] font-bold tracking-wider uppercase border border-slate-700 shadow">
                Original Page {activePageNum}
              </div>

              {/* Page Background Image */}
              <img
                src={activePageRes.imageDataUrl}
                alt={`Original page ${activePageNum}`}
                className="w-full h-auto block select-none"
                style={{ imageRendering: 'high-quality' }}
              />

              {/* Interactive Paragraph Bounding Overlays */}
              <div className="absolute inset-0 pointer-events-auto">
                {activePageRes.blocks.map((block) => {
                  const isSelected = block.id === selectedBlockId;
                  const isHovered = block.id === hoveredBlockId;

                  return (
                    <div
                      key={block.id}
                      onClick={() => setSelectedBlockId(block.id)}
                      onMouseEnter={() => setHoveredBlockId(block.id)}
                      onMouseLeave={() => setHoveredBlockId(null)}
                      className={`absolute cursor-pointer transition-all border rounded-sm ${
                        isSelected
                          ? 'bg-orange-500/25 border-orange-500 ring-2 ring-orange-500/50 z-20'
                          : isHovered
                          ? 'bg-amber-400/20 border-amber-400 z-10'
                          : 'border-blue-500/20 bg-blue-500/5 hover:border-blue-400/50'
                      }`}
                      style={{
                        top: `${(block.box.ymin / 1000) * 100}%`,
                        left: `${(block.box.xmin / 1000) * 100}%`,
                        width: `${((block.box.xmax - block.box.xmin) / 1000) * 100}%`,
                        height: `${((block.box.ymax - block.box.ymin) / 1000) * 100}%`,
                      }}
                      title={`Paragraph Box: ${block.originalText.slice(0, 40)}...`}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Side 2: Rendered Translated Hindi Canvas */}
          {viewMode === 'sideBySide' && (
            <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-white shadow-2xl">
              <div className="absolute top-2 left-2 z-10 px-2.5 py-1 rounded-md bg-orange-500 text-slate-950 text-[10px] font-bold tracking-wider uppercase shadow">
                Translated Hindi Page
              </div>

              {/* Canvas where Hindi translated text and background in-painting are rendered */}
              <canvas
                ref={translatedCanvasRef}
                className="w-full h-auto block select-none"
                style={{ imageRendering: 'high-quality' }}
              />

              {/* Interactive Highlight Overlays for Translated Side */}
              <div className="absolute inset-0 pointer-events-auto">
                {activePageRes.blocks.map((block) => {
                  const isSelected = block.id === selectedBlockId;
                  const isHovered = block.id === hoveredBlockId;

                  return (
                    <div
                      key={block.id}
                      onClick={() => setSelectedBlockId(block.id)}
                      onMouseEnter={() => setHoveredBlockId(block.id)}
                      onMouseLeave={() => setHoveredBlockId(null)}
                      className={`absolute cursor-pointer transition-all border rounded-sm ${
                        isSelected
                          ? 'bg-orange-500/20 border-orange-500 ring-2 ring-orange-500/50 z-20'
                          : isHovered
                          ? 'bg-amber-400/15 border-amber-400 z-10'
                          : 'border-transparent hover:border-orange-500/30'
                      }`}
                      style={{
                        top: `${(block.box.ymin / 1000) * 100}%`,
                        left: `${(block.box.xmin / 1000) * 100}%`,
                        width: `${((block.box.xmax - block.box.xmin) / 1000) * 100}%`,
                        height: `${((block.box.ymax - block.box.ymin) / 1000) * 100}%`,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Paragraph Inspector & Editing Drawer */}
      <div className="bg-slate-900 border-t border-slate-800 p-4 lg:p-5 flex flex-col gap-3">
        {selectedBlock ? (
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  Selected Paragraph Block
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Box: [{selectedBlock.box.ymin}, {selectedBlock.box.xmin}, {selectedBlock.box.ymax}, {selectedBlock.box.xmax}]
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Original English */}
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                    Original English Text
                  </span>
                  <p className="text-slate-300 font-sans leading-relaxed">{selectedBlock.originalText}</p>
                </div>

                {/* Translated Hindi */}
                <div className="p-2.5 rounded-lg bg-orange-500/5 border border-orange-500/20">
                  <span className="text-[10px] uppercase font-bold text-orange-400 block mb-1">
                    Translated Hindi Text (Devanagari)
                  </span>
                  <p className="text-white font-serif font-medium leading-relaxed font-['Hind'] text-sm">
                    {selectedBlock.translatedText}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Edit Trigger */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleStartEdit(selectedBlock)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 transition-all"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Fine-tune Paragraph</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-400 text-center py-2 flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Click any paragraph on the document to inspect, edit Hindi translation, or adjust font auto-scale.</span>
          </div>
        )}
      </div>

      {/* Paragraph Edit Modal */}
      {editingBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-orange-400" />
                <span>Fine-Tune Paragraph Translation</span>
              </h3>
              <button
                onClick={() => setEditingBlock(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-semibold block mb-1">Original English Text:</label>
                <div className="p-2.5 rounded-lg bg-slate-950 text-slate-300 border border-slate-800">
                  {editingBlock.originalText}
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Hindi Translation:</label>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={4}
                  className="w-full p-3 rounded-lg bg-slate-950 text-white border border-slate-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 font-['Hind'] text-sm leading-relaxed outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Adjust Font Size ({editFontSize}px):
                </label>
                <input
                  type="range"
                  min={8}
                  max={36}
                  step={0.5}
                  value={editFontSize}
                  onChange={(e) => setEditFontSize(Number(e.target.value))}
                  className="w-full accent-orange-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setEditingBlock(null)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-slate-950 text-xs font-semibold flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
