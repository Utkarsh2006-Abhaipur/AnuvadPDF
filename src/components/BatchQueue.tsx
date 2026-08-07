import React from 'react';
import { DocumentJob } from '../types';
import { FileText, Play, Download, Trash2, CheckCircle2, AlertCircle, RefreshCw, Plus, Clock } from 'lucide-react';

interface BatchQueueProps {
  jobs: DocumentJob[];
  activeJobId: string | null;
  onSelectJob: (jobId: string) => void;
  onTranslateJob: (jobId: string) => void;
  onRemoveJob: (jobId: string) => void;
  onDownloadJob: (jobId: string) => void;
  onAddMoreFiles: () => void;
}

export const BatchQueue: React.FC<BatchQueueProps> = ({
  jobs,
  activeJobId,
  onSelectJob,
  onTranslateJob,
  onRemoveJob,
  onDownloadJob,
  onAddMoreFiles,
}) => {
  if (jobs.length === 0) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Batch Queue ({jobs.length})
          </span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
            {jobs.filter((j) => j.status === 'completed').length} / {jobs.length} Ready
          </span>
        </div>
        <button
          onClick={onAddMoreFiles}
          className="flex items-center gap-1 text-xs font-medium text-orange-400 hover:text-orange-300 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Files</span>
        </button>
      </div>

      {/* Jobs List */}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {jobs.map((job) => {
          const isActive = job.id === activeJobId;
          const isCompleted = job.status === 'completed';
          const isError = job.status === 'error';
          const isProcessing = job.status === 'rendering' || job.status === 'ocr_translating';

          return (
            <div
              key={job.id}
              onClick={() => onSelectJob(job.id)}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 ${
                isActive
                  ? 'bg-slate-800/90 border-orange-500/50 shadow-md ring-1 ring-orange-500/20'
                  : 'bg-slate-800/30 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      isCompleted
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : isError
                        ? 'bg-rose-500/10 text-rose-400'
                        : isProcessing
                        ? 'bg-orange-500/10 text-orange-400'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-slate-200 truncate" title={job.fileName}>
                      {job.fileName}
                    </h4>
                    <p className="text-[11px] text-slate-400 flex items-center gap-2">
                      <span>{formatFileSize(job.fileSize)}</span>
                      <span>•</span>
                      <span>{job.pageCount > 0 ? `${job.pageCount} Pages` : 'Detecting pages...'}</span>
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {job.status === 'queued' && (
                    <button
                      onClick={() => onTranslateJob(job.id)}
                      className="p-1.5 rounded-lg text-slate-300 bg-slate-700 hover:bg-orange-500 hover:text-slate-950 transition-colors"
                      title="Start Translation"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                  )}

                  {isCompleted && (
                    <button
                      onClick={() => onDownloadJob(job.id)}
                      className="p-1.5 rounded-lg text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                      title="Download Translated PDF"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {isError && (
                    <button
                      onClick={() => onTranslateJob(job.id)}
                      className="p-1.5 rounded-lg text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition-colors"
                      title="Retry Translation"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={() => onRemoveJob(job.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-700/50 transition-colors"
                    title="Remove File"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Progress & Status Message */}
              {isProcessing && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="truncate">{job.progressStage || 'Processing document...'}</span>
                    <span className="font-mono text-orange-400">{job.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-orange-500 to-amber-400 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {isError && (
                <div className="text-[11px] text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{job.error || 'Translation failed'}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
