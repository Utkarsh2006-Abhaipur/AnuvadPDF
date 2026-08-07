import React from 'react';
import { X, CheckCircle2, Cpu, Eye, FileSpreadsheet, Layers, Type, Sparkles, ArrowRight } from 'lucide-react';

interface ImplementationPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImplementationPlanModal: React.FC<ImplementationPlanModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const steps = [
    {
      number: '01',
      title: 'Batch Drag-and-Drop & Document Parsing',
      icon: <FileSpreadsheet className="w-5 h-5 text-orange-400" />,
      description: 'Upload single or multiple PDF documents simultaneously. The system initializes batch jobs, parses page structures using PDF.js, and generates high-resolution canvas thumbnails.',
    },
    {
      number: '02',
      title: 'Multimodal Gemini OCR & Layout Analysis',
      icon: <Cpu className="w-5 h-5 text-amber-400" />,
      description: 'Each page canvas is submitted to Gemini 3.6 Flash. The vision engine detects exact paragraph bounding box coordinates [ymin, xmin, ymax, xmax] normalized 0-1000, font sizes, text alignments, and background HEX colors.',
    },
    {
      number: '03',
      title: 'Context-Aware English to Hindi Translation',
      icon: <Type className="w-5 h-5 text-yellow-400" />,
      description: 'The engine translates English paragraphs into fluent Hindi in Devanagari script. Paragraph structure, headings, bullet points, and domain context are strictly preserved.',
    },
    {
      number: '04',
      title: 'Font Auto-Fitting & In-Painting Engine',
      icon: <Sparkles className="w-5 h-5 text-emerald-400" />,
      description: 'Original text areas are in-painted with matching background color. A dynamic text-wrap and binary font scale algorithm adjusts Hindi font size to fit exact paragraph bounding boxes without overflow.',
    },
    {
      number: '05',
      title: 'Real-Time Interactive Dual Preview',
      icon: <Eye className="w-5 h-5 text-cyan-400" />,
      description: 'Users preview original vs. translated pages side-by-side or as in-place overlays with zoom controls. Paragraphs can be clicked to inspect or manually edit translated Hindi text before exporting.',
    },
    {
      number: '06',
      title: 'High-Fidelity PDF Re-construction',
      icon: <Layers className="w-5 h-5 text-indigo-400" />,
      description: 'pdf-lib re-assembles pristine vector PDF files containing original graphics, background images, and crisp Hindi typography, ready for single or batch zip download.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">System Implementation Plan</h2>
              <p className="text-xs text-slate-400">How AnuvadPDF processes PDF layout, OCR & Hindi translation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300">
          {/* Overview */}
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 leading-relaxed text-slate-300">
            <span className="font-semibold text-orange-400">AnuvadPDF Architecture:</span> This application implements end-to-end PDF layout-preserving translation from English to Hindi. By combining client-side canvas rendering (PDF.js) with server-side multimodal AI vision (Gemini 3.6 Flash), it extracts structured paragraphs with bounding boxes, translates them, and in-paints the Hindi text into identical spatial positions with auto-scaled font metrics.
          </div>

          {/* Workflow Steps Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {steps.map((step) => (
              <div
                key={step.number}
                className="p-4 rounded-xl bg-slate-800/30 border border-slate-800 hover:border-slate-700 transition-all flex flex-col gap-2 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-slate-800 border border-slate-700">
                      {step.icon}
                    </div>
                    <span className="font-bold text-slate-200 text-xs tracking-wide">
                      {step.title}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-500 group-hover:text-orange-400 transition-colors">
                    {step.number}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed pl-1">
                  {step.description}
                </p>
              </div>
            ))}
          </div>

          {/* Core Guarantees */}
          <div className="pt-2 border-t border-slate-800">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3">
              Guaranteed Technical Constraints
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-start gap-2 text-xs text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Paragraphs stay intact in original bounding boxes</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Auto font size adjustment to prevent text overflow</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Batch processing queue for multiple files</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-slate-950 font-semibold text-xs transition-colors"
          >
            Got It, Proceed to App
          </button>
        </div>
      </div>
    </div>
  );
};
