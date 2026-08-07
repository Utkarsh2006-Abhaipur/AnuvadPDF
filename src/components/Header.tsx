import React from 'react';
import { Languages, Layers, FileText, Info, Sparkles, Download, Play } from 'lucide-react';

interface HeaderProps {
  totalDocs: number;
  completedDocs: number;
  isProcessing: boolean;
  onOpenPlan: () => void;
  onTranslateAll: () => void;
  onExportBatch: () => void;
  hasDocs: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  totalDocs,
  completedDocs,
  isProcessing,
  onOpenPlan,
  onTranslateAll,
  onExportBatch,
  hasDocs,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 lg:px-8 py-3 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-orange-500 via-amber-500 to-amber-400 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-orange-500/20">
            <Languages className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight">
                Anuvad<span className="text-orange-400">PDF</span>
              </h1>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                English → Hindi
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Preserves Layout • OCR Vision • Paragraph Auto-Fit • Real-time Preview
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
          <button
            onClick={onOpenPlan}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition-all hover:text-white"
            title="View Technical Implementation Plan"
          >
            <Info className="w-3.5 h-3.5 text-amber-400" />
            <span>Workflow Plan</span>
          </button>

          {hasDocs && (
            <>
              <button
                onClick={onTranslateAll}
                disabled={isProcessing}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-md transition-all ${
                  isProcessing
                    ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                    : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 shadow-orange-500/20 hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                {isProcessing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                    <span>Translating Batch...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Translate All</span>
                  </>
                )}
              </button>

              {completedDocs > 0 && (
                <button
                  onClick={onExportBatch}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-all hover:border-emerald-500/50"
                  title="Export completed PDF documents"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download ({completedDocs})</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
};
