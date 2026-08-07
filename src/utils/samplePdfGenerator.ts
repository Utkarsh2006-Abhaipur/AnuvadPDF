import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/**
 * Generate a sample English PDF File in memory to allow users to instantly test
 * the OCR vision, English to Hindi translation, layout preservation, and batch queue.
 */
export async function createSampleEnglishPdf(): Promise<File> {
  const pdfDoc = await PDFDocument.create();
  const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // --- Page 1 ---
  const page1 = pdfDoc.addPage([595.28, 841.89]); // A4 Size in points
  const { width, height } = page1.getSize();

  // Title
  page1.drawText('Global AI Innovations & Future Outlook Report', {
    x: 50,
    y: height - 60,
    size: 20,
    font: helveticaBold,
    color: rgb(0.1, 0.1, 0.2),
  });

  // Subtitle
  page1.drawText('Annual Executive Summary and Technology Roadmaps (2026)', {
    x: 50,
    y: height - 85,
    size: 12,
    font: helvetica,
    color: rgb(0.4, 0.4, 0.5),
  });

  // Divider Line
  page1.drawLine({
    start: { x: 50, y: height - 95 },
    end: { x: width - 50, y: height - 95 },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });

  // Paragraph 1
  const p1Text =
    'Artificial intelligence is transforming industries worldwide through automated reasoning, multimodal vision systems, and intelligent agent workflows. Organizations that adopt modern AI technologies report significant improvements in operational efficiency, decision-making quality, and customer satisfaction.';

  page1.drawText(p1Text, {
    x: 50,
    y: height - 130,
    size: 11,
    font: timesRomanFont,
    color: rgb(0.2, 0.2, 0.2),
    maxWidth: width - 100,
    lineHeight: 16,
  });

  // Section Heading
  page1.drawText('Key Findings and Strategic Pillars', {
    x: 50,
    y: height - 210,
    size: 14,
    font: helveticaBold,
    color: rgb(0.85, 0.35, 0.05),
  });

  // Bullet Points Paragraphs
  const b1 = '• Generative language models enable real-time multilingual document translation without losing original context.';
  const b2 = '• Automated OCR vision engines accurately detect layout structures, paragraph boundaries, and typography.';
  const b3 = '• In-place text auto-fitting ensures translated paragraphs fit neatly inside original document dimensions.';

  page1.drawText(b1, {
    x: 60,
    y: height - 240,
    size: 10.5,
    font: helvetica,
    color: rgb(0.25, 0.25, 0.25),
    maxWidth: width - 120,
    lineHeight: 15,
  });

  page1.drawText(b2, {
    x: 60,
    y: height - 280,
    size: 10.5,
    font: helvetica,
    color: rgb(0.25, 0.25, 0.25),
    maxWidth: width - 120,
    lineHeight: 15,
  });

  page1.drawText(b3, {
    x: 60,
    y: height - 320,
    size: 10.5,
    font: helvetica,
    color: rgb(0.25, 0.25, 0.25),
    maxWidth: width - 120,
    lineHeight: 15,
  });

  // Paragraph 2
  const p2Text =
    'In conclusion, combining computer vision OCR with neural machine translation empowers global teams to bridge language barriers effortlessly. By keeping document formatting intact, readers experience native readability across technical manuals, reports, and books.';

  page1.drawText(p2Text, {
    x: 50,
    y: height - 380,
    size: 11,
    font: timesRomanFont,
    color: rgb(0.2, 0.2, 0.2),
    maxWidth: width - 100,
    lineHeight: 16,
  });

  // Save to Blob and create File
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  return new File([blob], 'Sample_AI_Report_English.pdf', { type: 'application/pdf' });
}
