export interface BoundingBox {
  ymin: number; // 0 - 1000
  xmin: number; // 0 - 1000
  ymax: number; // 0 - 1000
  xmax: number; // 0 - 1000
}

export interface ParagraphBlock {
  id: string;
  box: BoundingBox;
  originalText: string;
  translatedText: string;
  fontSize: number; // estimated font size in pt or px
  adjustedFontSize?: number; // font size adjusted to fit within bounding box
  textColor?: string;
  bgColor?: string;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  isHeading?: boolean;
}

export interface PageTranslationResult {
  pageNumber: number;
  width: number;
  height: number;
  imageDataUrl: string; // Base64 data URL of rendered page background
  blocks: ParagraphBlock[];
}

export interface DocumentJob {
  id: string;
  fileName: string;
  fileSize: number;
  file: File;
  status: 'queued' | 'rendering' | 'ocr_translating' | 'completed' | 'error';
  progress: number; // 0 to 100
  progressStage?: string;
  error?: string;
  pageCount: number;
  pages: PageTranslationResult[];
  activePage: number;
}

export interface TranslationSettings {
  targetLanguage: string; // 'Hindi'
  preserveFormatting: boolean;
  autoFitFont: boolean;
  minFontSize: number;
  maxFontSize: number;
  fontFamily: string; // 'Noto Sans Devanagari', 'Hind', sans-serif
}
