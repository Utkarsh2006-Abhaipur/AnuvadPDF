import * as pdfjsLib from "pdfjs-dist";
import { PDFDocument, rgb } from "pdf-lib";
import { PageTranslationResult, ParagraphBlock, DocumentJob } from "../types";

// Import worker URL using Vite's asset import or unpkg CDN fallback
try {
  // Try CDN unpkg which reliably hosts all pdfjs-dist builds
  const pdfjsVersion = pdfjsLib.version || "4.10.38";
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;
} catch (e) {
  console.warn("Falling back to cdnjs workerSrc", e);
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs`;
}

/**
 * Render a single page of a PDF File to a High-DPI Base64 PNG Image URL and return dimensions
 */
export async function renderPdfPageToDataUrl(
  file: File,
  pageIndex: number,
  scale: number = 2.5
): Promise<{ dataUrl: string; width: number; height: number; totalPages: number }> {
  const arrayBuffer = await file.arrayBuffer();
  let pdfDoc;

  try {
    pdfDoc = await pdfjsLib.getDocument({
      data: arrayBuffer,
      cMapUrl: "https://unpkg.com/pdfjs-dist@3.11.174/cmaps/",
      cMapPacked: true,
    }).promise;
  } catch (err1) {
    console.warn("First PDF.js loading attempt failed, retrying with fallback worker configuration...", err1);
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    pdfDoc = await pdfjsLib.getDocument({
      data: arrayBuffer,
      cMapUrl: "https://unpkg.com/pdfjs-dist@3.11.174/cmaps/",
      cMapPacked: true,
    }).promise;
  }

  const totalPages = pdfDoc.numPages;

  if (pageIndex < 1 || pageIndex > totalPages) {
    throw new Error(`Page index ${pageIndex} out of bounds (1-${totalPages})`);
  }

  const page = await pdfDoc.getPage(pageIndex);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Could not get 2D canvas context");

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  await page.render({
    canvasContext: context,
    viewport: viewport,
  }).promise;

  const dataUrl = canvas.toDataURL("image/png");

  return {
    dataUrl,
    width: viewport.width / scale, // Original PDF points
    height: viewport.height / scale,
    totalPages,
  };
}

/**
 * Calculate dynamic auto-fitted font size to ensure translated Hindi text fits neatly
 * inside the paragraph bounding box without overflow or overlap.
 */
export function calculateAutoFitFontSize(
  text: string,
  boxWidthPx: number,
  boxHeightPx: number,
  baseFontSize: number = 14,
  isHeading: boolean = false
): number {
  if (!text || boxWidthPx <= 0 || boxHeightPx <= 0) return baseFontSize;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return baseFontSize;

  const padding = 4;
  const availWidth = Math.max(boxWidthPx - padding * 2, 10);
  const availHeight = Math.max(boxHeightPx - padding * 2, 10);

  let currentSize = isHeading ? Math.max(baseFontSize, 18) : baseFontSize;
  const minSize = 8;
  const maxSize = isHeading ? 48 : 36;

  // Binary or step search to find optimal fitting font size
  for (let sz = Math.min(currentSize * 1.3, maxSize); sz >= minSize; sz -= 0.5) {
    ctx.font = `${isHeading ? "bold" : "normal"} ${sz}px "Hind", "Noto Sans Devanagari", sans-serif`;
    
    // Estimate line wrapping
    const words = text.split(" ");
    let lines = 0;
    let currentLine = "";

    for (let i = 0; i < words.length; i++) {
      const testLine = currentLine ? `${currentLine} ${words[i]}` : words[i];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > availWidth && currentLine !== "") {
        lines++;
        currentLine = words[i];
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines++;

    const lineHeight = sz * 1.25;
    const totalHeightNeeded = lines * lineHeight;

    if (totalHeightNeeded <= availHeight) {
      return Math.round(sz * 10) / 10;
    }
  }

  return minSize;
}

/**
 * Render translated canvas with replaced Hindi text and in-painted original backgrounds.
 * Uses high-DPI super-sampling and anti-aliased font rendering for razor-sharp clarity.
 */
export async function renderTranslatedPageToCanvas(
  pageResult: PageTranslationResult,
  targetCanvas: HTMLCanvasElement,
  scale: number = 2.5
): Promise<void> {
  // Ensure web fonts (Hind & Noto Sans Devanagari) are fully loaded before canvas text rendering
  if (typeof document !== "undefined" && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // Continue if font API unavailable
    }
  }

  const img = new Image();
  img.crossOrigin = "anonymous";
  
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = pageResult.imageDataUrl;
  });

  const width = img.width;
  const height = img.height;

  // High-DPI super-sampling multiplier (1.5x on top of base image) for vector-sharp text
  const dpr = 1.5;

  targetCanvas.width = Math.round(width * dpr);
  targetCanvas.height = Math.round(height * dpr);

  const ctx = targetCanvas.getContext("2d");
  if (!ctx) return;

  // Enable high-quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Scale context to match super-sampling multiplier
  ctx.scale(dpr, dpr);

  // Draw background original page image
  ctx.drawImage(img, 0, 0, width, height);

  // Process each paragraph block
  for (const block of pageResult.blocks) {
    const xminPx = (block.box.xmin / 1000) * width;
    const yminPx = (block.box.ymin / 1000) * height;
    const xmaxPx = (block.box.xmax / 1000) * width;
    const ymaxPx = (block.box.ymax / 1000) * height;
    const boxW = Math.max(xmaxPx - xminPx, 10);
    const boxH = Math.max(ymaxPx - yminPx, 10);

    // In-paint / cover original English text with background color
    ctx.fillStyle = block.bgColor || "#FFFFFF";
    ctx.fillRect(xminPx - 1, yminPx - 1, boxW + 2, boxH + 2);

    // Calculate fitted font size relative to rendered canvas width
    const fittedFontSize =
      block.adjustedFontSize ||
      calculateAutoFitFontSize(
        block.translatedText,
        boxW,
        boxH,
        block.fontSize * (scale / 1.5),
        block.isHeading
      );

    // Render translated Hindi text with font anti-aliasing & crisp Devanagari styling
    ctx.fillStyle = block.textColor || "#000000";
    ctx.font = `${block.isHeading ? "600" : "400"} ${fittedFontSize}px "Hind", "Noto Sans Devanagari", sans-serif`;
    ctx.textBaseline = "top";

    // Word wrap & draw lines
    const words = block.translatedText.split(" ");
    let currentLine = "";
    let lineY = yminPx + 2;
    const lineHeight = fittedFontSize * 1.35;

    for (let i = 0; i < words.length; i++) {
      const testLine = currentLine ? `${currentLine} ${words[i]}` : words[i];
      const metrics = ctx.measureText(testLine);

      if (metrics.width > boxW && currentLine !== "") {
        // Draw current line with alignment
        let lineX = xminPx;
        if (block.alignment === "center") {
          lineX = xminPx + (boxW - ctx.measureText(currentLine).width) / 2;
        } else if (block.alignment === "right") {
          lineX = xminPx + (boxW - ctx.measureText(currentLine).width);
        }

        if (lineY + lineHeight <= ymaxPx + 12) {
          ctx.fillText(currentLine, lineX, lineY);
        }
        lineY += lineHeight;
        currentLine = words[i];
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine && lineY + lineHeight <= ymaxPx + 16) {
      let lineX = xminPx;
      if (block.alignment === "center") {
        lineX = xminPx + (boxW - ctx.measureText(currentLine).width) / 2;
      } else if (block.alignment === "right") {
        lineX = xminPx + (boxW - ctx.measureText(currentLine).width);
      }
      ctx.fillText(currentLine, lineX, lineY);
    }
  }
}

/**
 * Generate a downloadable translated PDF document preserving exact dimensions and layout.
 */
export async function generateTranslatedPdfBlob(job: DocumentJob): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();

  for (const pageRes of job.pages) {
    // Render translated canvas for the page
    const canvas = document.createElement("canvas");
    await renderTranslatedPageToCanvas(pageRes, canvas, 2.0);

    // Use JPEG with 85% quality for fast compression and 85-90% smaller file size (~1.5MB instead of 23MB)
    const canvasDataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const jpgImageBytes = await fetch(canvasDataUrl).then((r) => r.arrayBuffer());
    const jpgImage = await pdfDoc.embedJpg(jpgImageBytes);

    // Create page matching exact page dimensions
    const page = pdfDoc.addPage([pageRes.width, pageRes.height]);
    page.drawImage(jpgImage, {
      x: 0,
      y: 0,
      width: pageRes.width,
      height: pageRes.height,
    });
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: "application/pdf" });
}

/**
 * Extract vector text blocks directly from digital PDF pages using PDF.js text layer.
 * Returns null if the page has no selectable text (scanned PDF).
 */
export async function extractPdfTextBlocks(
  file: File,
  pageIndex: number
): Promise<ParagraphBlock[] | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    let pdfDoc;
    try {
      pdfDoc = await pdfjsLib.getDocument({
        data: arrayBuffer,
        cMapUrl: "https://unpkg.com/pdfjs-dist@3.11.174/cmaps/",
        cMapPacked: true,
      }).promise;
    } catch {
      pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    }

    const page = await pdfDoc.getPage(pageIndex);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();

    if (!textContent || !textContent.items || textContent.items.length === 0) {
      return null;
    }

    const items: Array<{
      str: string;
      xmin: number;
      ymin: number;
      xmax: number;
      ymax: number;
      height: number;
    }> = [];

    for (const item of textContent.items as any[]) {
      if (!item.str || item.str.trim().length === 0) continue;
      const transform = item.transform; // [scaleX, skewX, skewY, scaleY, x, y]
      if (!transform || transform.length < 6) continue;

      const x = transform[4];
      const fontH = Math.abs(transform[3]) || item.height || 12;
      const y = viewport.height - transform[5] - fontH;
      const w = item.width || (item.str.length * fontH * 0.5);

      const xmin = Math.max(0, Math.min(1000, Math.round((x / viewport.width) * 1000)));
      const ymin = Math.max(0, Math.min(1000, Math.round((y / viewport.height) * 1000)));
      const xmax = Math.max(0, Math.min(1000, Math.round(((x + w) / viewport.width) * 1000)));
      const ymax = Math.max(0, Math.min(1000, Math.round(((y + fontH) / viewport.height) * 1000)));

      items.push({
        str: item.str,
        xmin,
        ymin,
        xmax: Math.max(xmax, xmin + 10),
        ymax: Math.max(ymax, ymin + 10),
        height: fontH,
      });
    }

    if (items.length === 0) return null;

    // Sort items by Y (top to bottom) then X (left to right)
    items.sort((a, b) => {
      if (Math.abs(a.ymin - b.ymin) > 15) return a.ymin - b.ymin;
      return a.xmin - b.xmin;
    });

    const blocks: ParagraphBlock[] = [];
    let currentBlock: {
      str: string;
      xmin: number;
      ymin: number;
      xmax: number;
      ymax: number;
      fontSize: number;
    } | null = null;

    for (const item of items) {
      if (!currentBlock) {
        currentBlock = {
          str: item.str,
          xmin: item.xmin,
          ymin: item.ymin,
          xmax: item.xmax,
          ymax: item.ymax,
          fontSize: item.height,
        };
        continue;
      }

      const sameLine = Math.abs(item.ymin - currentBlock.ymin) < 18;
      const yDist = Math.abs(item.ymin - currentBlock.ymax);
      const nextLine = yDist < 35 && item.xmin < currentBlock.xmax + 200;

      if (sameLine || nextLine) {
        currentBlock.str += (sameLine ? " " : "\n") + item.str;
        currentBlock.xmin = Math.min(currentBlock.xmin, item.xmin);
        currentBlock.ymin = Math.min(currentBlock.ymin, item.ymin);
        currentBlock.xmax = Math.max(currentBlock.xmax, item.xmax);
        currentBlock.ymax = Math.max(currentBlock.ymax, item.ymax);
      } else {
        blocks.push({
          id: `block_${blocks.length + 1}`,
          box: {
            ymin: currentBlock.ymin,
            xmin: currentBlock.xmin,
            ymax: currentBlock.ymax,
            xmax: currentBlock.xmax,
          },
          originalText: currentBlock.str,
          translatedText: "",
          fontSize: Math.round(currentBlock.fontSize * 1.5) || 16,
          alignment: "left",
          bgColor: "#FFFFFF",
          textColor: "#000000",
          isHeading: currentBlock.fontSize > 18 || currentBlock.str.length < 40,
        });

        currentBlock = {
          str: item.str,
          xmin: item.xmin,
          ymin: item.ymin,
          xmax: item.xmax,
          ymax: item.ymax,
          fontSize: item.height,
        };
      }
    }

    if (currentBlock) {
      blocks.push({
        id: `block_${blocks.length + 1}`,
        box: {
          ymin: currentBlock.ymin,
          xmin: currentBlock.xmin,
          ymax: currentBlock.ymax,
          xmax: currentBlock.xmax,
        },
        originalText: currentBlock.str,
        translatedText: "",
        fontSize: Math.round(currentBlock.fontSize * 1.5) || 16,
        alignment: "left",
        bgColor: "#FFFFFF",
        textColor: "#000000",
        isHeading: currentBlock.fontSize > 18 || currentBlock.str.length < 40,
      });
    }

    return blocks.length > 0 ? blocks : null;
  } catch (err) {
    console.warn("PDF vector text extraction fallback to Vision OCR:", err);
    return null;
  }
}
