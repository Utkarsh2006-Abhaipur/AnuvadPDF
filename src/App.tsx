/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Header } from './components/Header';
import { ImplementationPlanModal } from './components/ImplementationPlanModal';
import { Dropzone } from './components/Dropzone';
import { BatchQueue } from './components/BatchQueue';
import { InteractivePreview } from './components/InteractivePreview';
import { DocumentJob, PageTranslationResult } from './types';
import { renderPdfPageToDataUrl, calculateAutoFitFontSize, generateTranslatedPdfBlob, extractPdfTextBlocks } from './utils/pdfRenderer';
import { createSampleEnglishPdf } from './utils/samplePdfGenerator';
import { Languages, Sparkles, Layers, FileCheck, CheckCircle, AlertCircle } from 'lucide-react';

export default function App() {
  const [jobs, setJobs] = useState<DocumentJob[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isPlanOpen, setIsPlanOpen] = useState<boolean>(false);
  const [isProcessingBatch, setIsProcessingBatch] = useState<boolean>(false);

  // Add files to batch queue
  const handleFilesAdded = async (files: File[]) => {
    const newJobs: DocumentJob[] = [];

    for (const file of files) {
      const id = `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      newJobs.push({
        id,
        fileName: file.name,
        fileSize: file.size,
        file,
        status: 'queued',
        progress: 0,
        pageCount: 0,
        pages: [],
        activePage: 1,
      });
    }

    setJobs((prev) => [...prev, ...newJobs]);
    if (!activeJobId && newJobs.length > 0) {
      setActiveJobId(newJobs[0].id);
    }
  };

  // Add sample English PDF
  const handleAddSampleDoc = async () => {
    const sampleFile = await createSampleEnglishPdf();
    await handleFilesAdded([sampleFile]);
  };

  // Process a single document job
  const processDocumentJob = async (jobId: string) => {
    const targetJob = jobs.find((j) => j.id === jobId);
    if (!targetJob) return;

    // Update status to rendering
    setJobs((prev) =>
      prev.map((j) =>
        j.id === jobId
          ? { ...j, status: 'rendering', progress: 10, progressStage: 'Rendering PDF pages to canvas...' }
          : j
      )
    );

    try {
      // Step 1: Render first page to determine page count
      const firstPage = await renderPdfPageToDataUrl(targetJob.file, 1, 1.5);
      const totalPages = firstPage.totalPages;

      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, pageCount: totalPages } : j))
      );

      const renderedPages: PageTranslationResult[] = [];

      // Render & translate page by page
      for (let pNum = 1; pNum <= totalPages; pNum++) {
        const renderProgress = 10 + Math.round((pNum / totalPages) * 30);
        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  status: 'rendering',
                  progress: renderProgress,
                  progressStage: `Rendering page ${pNum} of ${totalPages}...`,
                }
              : j
          )
        );

        const pageRender =
          pNum === 1 ? firstPage : await renderPdfPageToDataUrl(targetJob.file, pNum, 1.5);

        // Step 2: Hybrid Translation Pipeline
        // Fast path: Extract PDF vector text blocks directly via PDF.js if available
        let translationData: any = null;
        const extractedVectorBlocks = await extractPdfTextBlocks(targetJob.file, pNum);

        if (extractedVectorBlocks && extractedVectorBlocks.length > 0) {
          // Vector PDF page with selectable text -> Ultra fast text translation (uses ~95% less quota)
          setJobs((prev) =>
            prev.map((j) =>
              j.id === jobId
                ? {
                    ...j,
                    status: 'ocr_translating',
                    progress: 40 + Math.round((pNum / totalPages) * 50),
                    progressStage: `Translating digital text on page ${pNum} of ${totalPages}...`,
                  }
                : j
            )
          );

          try {
            const apiRes = await fetch('/api/translate-text-blocks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ blocks: extractedVectorBlocks }),
            });

            if (apiRes.ok) {
              translationData = await apiRes.json();
            } else {
              console.warn(`Text translation API failed with ${apiRes.status}, falling back to Vision OCR`);
            }
          } catch (textErr) {
            console.warn('Text translation fetch failed, falling back to Vision OCR:', textErr);
          }
        }

        // Slow path: Fallback to Multimodal Vision OCR if vector extraction returned null or failed (scanned PDF)
        if (!translationData) {
          setJobs((prev) =>
            prev.map((j) =>
              j.id === jobId
                ? {
                    ...j,
                    status: 'ocr_translating',
                    progress: 40 + Math.round((pNum / totalPages) * 50),
                    progressStage: `Running OCR vision & translating page ${pNum} of ${totalPages}...`,
                  }
                : j
            )
          );

          let lastApiErr: any = null;
          const maxFetchRetries = 3;

          for (let fetchAttempt = 1; fetchAttempt <= maxFetchRetries; fetchAttempt++) {
            try {
              const apiRes = await fetch('/api/translate-page', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  imageBase64: pageRender.dataUrl,
                  pageNumber: pNum,
                  totalPages,
                }),
              });

              if (!apiRes.ok) {
                const errData = await apiRes.json().catch(() => ({}));
                throw new Error(errData.error || `Server responded with status ${apiRes.status}`);
              }

              translationData = await apiRes.json();
              break; // Success
            } catch (fetchErr: any) {
              lastApiErr = fetchErr;
              console.warn(`Vision OCR attempt ${fetchAttempt} failed:`, fetchErr);
              if (fetchAttempt < maxFetchRetries) {
                setJobs((prev) =>
                  prev.map((j) =>
                    j.id === jobId
                      ? {
                          ...j,
                          progressStage: `Server busy / rate limit. Retrying page ${pNum} (${fetchAttempt}/${maxFetchRetries})...`,
                        }
                      : j
                  )
                );
                await new Promise((r) => setTimeout(r, 3000 * fetchAttempt));
              }
            }
          }

          if (!translationData) {
            throw lastApiErr || new Error(`Failed to process page ${pNum}`);
          }
        }

        // Pacing delay to avoid API burst rate limits only when using heavy Vision OCR
        const isDigitalFastPath = extractedVectorBlocks && extractedVectorBlocks.length > 0;
        if (!isDigitalFastPath && totalPages > 1 && pNum < totalPages) {
          await new Promise((r) => setTimeout(r, 300));
        }

        // Step 3: Calculate font auto-fitting per block
        const processedBlocks = (translationData.blocks || []).map((b: any) => {
          const boxW = Math.max(((b.box.xmax - b.box.xmin) / 1000) * pageRender.width, 10);
          const boxH = Math.max(((b.box.ymax - b.box.ymin) / 1000) * pageRender.height, 10);
          const fittedSize = calculateAutoFitFontSize(
            b.translatedText,
            boxW,
            boxH,
            b.fontSize * 1.3,
            b.isHeading
          );
          return {
            ...b,
            adjustedFontSize: fittedSize,
          };
        });

        renderedPages.push({
          pageNumber: pNum,
          width: pageRender.width,
          height: pageRender.height,
          imageDataUrl: pageRender.dataUrl,
          blocks: processedBlocks,
        });
      }

      // Complete job
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                status: 'completed',
                progress: 100,
                progressStage: 'Translation complete!',
                pages: renderedPages,
              }
            : j
        )
      );
    } catch (err: any) {
      console.error('Job processing error:', err);
      const rawMsg = String(err.message || err);
      let userFriendlyErr = rawMsg;

      if (rawMsg.includes('503') || rawMsg.includes('high demand') || rawMsg.includes('UNAVAILABLE')) {
        userFriendlyErr = 'AI model server is experiencing high demand (503). Click Retry to resume translation.';
      } else if (rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
        userFriendlyErr = 'Rate limit reached. Please wait a moment and click Retry.';
      }

      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                status: 'error',
                error: userFriendlyErr,
                progressStage: 'Translation paused due to server load',
              }
            : j
        )
      );
    }
  };

  // Translate all pending or error jobs
  const handleTranslateAll = async () => {
    setIsProcessingBatch(true);
    const pendingJobs = jobs.filter((j) => j.status === 'queued' || j.status === 'error');

    for (const job of pendingJobs) {
      await processDocumentJob(job.id);
    }
    setIsProcessingBatch(false);
  };

  // Remove job from batch
  const handleRemoveJob = (jobId: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
    if (activeJobId === jobId) {
      const remaining = jobs.filter((j) => j.id !== jobId);
      setActiveJobId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  // Download translated PDF
  const handleDownloadJob = async (jobId: string) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job || job.status !== 'completed') return;

    const pdfBlob = await generateTranslatedPdfBlob(job);
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${job.fileName.replace(/\.pdf$/i, '')}_Hindi_Translated.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export batch
  const handleExportBatch = async () => {
    const completedJobs = jobs.filter((j) => j.status === 'completed');
    for (const job of completedJobs) {
      await handleDownloadJob(job.id);
    }
  };

  // Inline edit paragraph
  const handleUpdateParagraph = (
    pageNumber: number,
    blockId: string,
    updatedText: string,
    updatedFontSize?: number
  ) => {
    if (!activeJobId) return;

    setJobs((prev) =>
      prev.map((job) => {
        if (job.id !== activeJobId) return job;

        const updatedPages = job.pages.map((pg) => {
          if (pg.pageNumber !== pageNumber) return pg;

          const updatedBlocks = pg.blocks.map((block) => {
            if (block.id !== blockId) return block;
            return {
              ...block,
              translatedText: updatedText,
              adjustedFontSize: updatedFontSize || block.adjustedFontSize,
            };
          });

          return { ...pg, blocks: updatedBlocks };
        });

        return { ...job, pages: updatedPages };
      })
    );
  };

  const activeJob = jobs.find((j) => j.id === activeJobId);
  const completedDocsCount = jobs.filter((j) => j.status === 'completed').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      {/* Header */}
      <Header
        totalDocs={jobs.length}
        completedDocs={completedDocsCount}
        isProcessing={isProcessingBatch}
        onOpenPlan={() => setIsPlanOpen(true)}
        onTranslateAll={handleTranslateAll}
        onExportBatch={handleExportBatch}
        hasDocs={jobs.length > 0}
      />

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 flex flex-col gap-6">
        {jobs.length === 0 ? (
          /* Empty State - Dropzone & Introduction */
          <div className="flex-1 flex flex-col items-center justify-center py-8 space-y-8 max-w-4xl mx-auto w-full">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Multimodal Vision OCR & Hindi In-Place PDF Translator</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Translate English PDFs to Hindi
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-300">
                  Preserving Paragraphs & Exact Layout
                </span>
              </h2>
              <p className="text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">
                Upload single or batch PDF documents. Our AI vision system extracts paragraphs, computes auto-fitted font sizes, and overlays fluent Hindi text directly in place.
              </p>
            </div>

            {/* Dropzone */}
            <Dropzone onFilesAdded={handleFilesAdded} onAddSampleDoc={handleAddSampleDoc} />
          </div>
        ) : (
          /* Active Workspace with Batch Sidebar & Real-Time Interactive Previewer */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-1">
            {/* Left Column: Batch Queue (4 cols on lg) */}
            <div className="lg:col-span-4 space-y-4">
              <BatchQueue
                jobs={jobs}
                activeJobId={activeJobId}
                onSelectJob={(id) => setActiveJobId(id)}
                onTranslateJob={processDocumentJob}
                onRemoveJob={handleRemoveJob}
                onDownloadJob={handleDownloadJob}
                onAddMoreFiles={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'application/pdf';
                  input.multiple = true;
                  input.onchange = (e: any) => {
                    if (e.target.files) {
                      handleFilesAdded(Array.from(e.target.files));
                    }
                  };
                  input.click();
                }}
              />

              {/* Quick Document Info Badge */}
              {activeJob && (
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-400 space-y-2">
                  <div className="flex items-center justify-between text-slate-300 font-semibold">
                    <span>Active Document Details</span>
                    <span className="text-[10px] uppercase font-bold text-orange-400">
                      {activeJob.status}
                    </span>
                  </div>
                  <p className="truncate text-slate-200 font-mono">{activeJob.fileName}</p>
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800">
                    <span>Pages: {activeJob.pageCount || '—'}</span>
                    <span>Paragraph Blocks: {activeJob.pages.reduce((acc, p) => acc + p.blocks.length, 0)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Interactive Real-Time Previewer (8 cols on lg) */}
            <div className="lg:col-span-8 flex flex-col h-full min-h-[680px]">
              {activeJob ? (
                activeJob.status === 'completed' && activeJob.pages.length > 0 ? (
                  <InteractivePreview
                    job={activeJob}
                    onUpdateParagraph={handleUpdateParagraph}
                    onDownloadPdf={() => handleDownloadJob(activeJob.id)}
                  />
                ) : (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-4 flex-1 min-h-[500px]">
                    {activeJob.status === 'queued' ? (
                      <>
                        <div className="p-4 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                          <Languages className="w-8 h-8" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-base font-bold text-white">Document Ready in Queue</h3>
                          <p className="text-xs text-slate-400 max-w-sm">
                            Click "Start Translation" or "Translate All" to process OCR vision and Hindi paragraph layout auto-fitting.
                          </p>
                        </div>
                        <button
                          onClick={() => processDocumentJob(activeJob.id)}
                          className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-slate-950 text-xs font-bold shadow-lg shadow-orange-500/20 transition-all hover:scale-105"
                        >
                          Translate This Document
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
                        <div className="space-y-1">
                          <h3 className="text-base font-bold text-white">
                            {activeJob.progressStage || 'Translating document...'}
                          </h3>
                          <p className="text-xs text-slate-400 font-mono">
                            Progress: {activeJob.progress}%
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 flex-1">
                  Select a document from the batch queue to view real-time translation preview.
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Technical Implementation Plan Modal */}
      <ImplementationPlanModal isOpen={isPlanOpen} onClose={() => setIsPlanOpen(false)} />
    </div>
  );
}
