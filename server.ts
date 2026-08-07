import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase JSON body payload limit for base64 image data
app.use(express.json({ limit: "50mb" }));

// Initialize Google Gen AI client
const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is missing");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

// Helper to clean & repair potentially truncated or markdown-wrapped JSON from LLM
function cleanAndParseJson(text: string): any {
  let cleaned = text.trim();
  // Strip markdown code fences if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }

  // 1. Direct JSON parse attempt
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn("Direct JSON parse failed, attempting repair for truncated output...", e);
  }

  // 2. Attempt JSON repair for truncated response
  try {
    let repaired = cleaned;

    // Check if open string quote exists at the end
    let inString = false;
    let escape = false;
    for (let i = 0; i < repaired.length; i++) {
      const ch = repaired[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
      }
    }

    if (inString) {
      repaired += '"';
    }

    // Remove dangling commas at end
    repaired = repaired.replace(/,\s*$/, "");

    // Balance brackets and braces
    let openBrackets = 0;
    let openBraces = 0;
    inString = false;
    escape = false;

    for (let i = 0; i < repaired.length; i++) {
      const ch = repaired[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (ch === "[") openBrackets++;
        if (ch === "]") openBrackets--;
        if (ch === "{") openBraces++;
        if (ch === "}") openBraces--;
      }
    }

    while (openBraces > 0) {
      repaired += "}";
      openBraces--;
    }
    while (openBrackets > 0) {
      repaired += "]";
      openBrackets--;
    }

    return JSON.parse(repaired);
  } catch (err) {
    console.warn("Repaired JSON parse failed, attempting regex extraction of complete blocks...", err);

    // 3. Fallback: regex scan for valid block entries
    const blocks: any[] = [];
    const blockRegex = /\{\s*"ymin":\s*(\d+(?:\.\d+)?),\s*"xmin":\s*(\d+(?:\.\d+)?),\s*"ymax":\s*(\d+(?:\.\d+)?),\s*"xmax":\s*(\d+(?:\.\d+)?),\s*"originalText":\s*"((?:[^"\\]|\\.)*)",\s*"translatedText":\s*"((?:[^"\\]|\\.)*)"/g;
    let match;
    while ((match = blockRegex.exec(text)) !== null) {
      blocks.push({
        ymin: Number(match[1]),
        xmin: Number(match[2]),
        ymax: Number(match[3]),
        xmax: Number(match[4]),
        originalText: match[5].replace(/\\"/g, '"').replace(/\\n/g, "\n"),
        translatedText: match[6].replace(/\\"/g, '"').replace(/\\n/g, "\n"),
      });
    }

    if (blocks.length > 0) {
      return { blocks };
    }

    throw new Error("Unable to parse translated PDF blocks from AI output.");
  }
}

// Helper function with exponential backoff retry & fallback model for API high demand (503 / 429) errors
async function generateContentWithRetry(ai: any, params: any) {
  const modelsToTry = ["gemini-3.6-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
  const maxRetriesPerModel = 3;

  let lastError: any = null;

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= maxRetriesPerModel; attempt++) {
      try {
        console.log(`[AI Translation Request] Model: ${model}, Attempt ${attempt}/${maxRetriesPerModel}`);
        const response = await ai.models.generateContent({
          ...params,
          model,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const errString = String(err.message || err);
        const isNotFound = errString.includes("404") || errString.includes("NOT_FOUND") || errString.includes("no longer available");
        const is503OrRateLimit =
          errString.includes("503") ||
          errString.includes("UNAVAILABLE") ||
          errString.includes("429") ||
          errString.includes("RESOURCE_EXHAUSTED") ||
          errString.includes("high demand") ||
          errString.includes("exceeded your current quota");

        console.warn(
          `[AI Error - Attempt ${attempt} on ${model}]: ${errString.substring(0, 150)}...`
        );

        if (isNotFound) {
          // Model does not exist or deprecated, immediately switch to next model
          console.warn(`Model ${model} not found/deprecated, skipping...`);
          break;
        }

        if (is503OrRateLimit) {
          // Exponential backoff delay: 3s, 6s, 9s
          const backoffMs = attempt * 3000;
          console.log(`Model ${model} experiencing high demand/quota rate limit (503/429). Retrying in ${backoffMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        } else {
          // Non-transient error, break to try next model or throw
          break;
        }
      }
    }
  }

  throw lastError || new Error("All AI translation model attempts failed.");
}

// Health Check API
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "PDF Translator English-Hindi API" });
});

// Fast Text-Only Translation Endpoint (for vector/digital PDFs extracted via PDF.js)
app.post("/api/translate-text-blocks", async (req, res) => {
  try {
    const { blocks } = req.body;

    if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
      return res.status(400).json({ error: "blocks array is required" });
    }

    const ai = getGenAI();

    const textToTranslate = blocks.map((b: any) => ({
      id: b.id,
      text: b.originalText,
    }));

    const prompt = `Translate each English text paragraph/item to fluent, accurate Hindi (Devanagari script).
Keep paragraph meaning, technical terms, tone, and formatting intact.
Input items:
${JSON.stringify(textToTranslate, null, 2)}

Return JSON adhering to schema with list of translated objects containing 'id' and 'translatedText'.`;

    const response = await generateContentWithRetry(ai, {
      contents: [{ text: prompt }],
      config: {
        systemInstruction: "You strictly output accurate English-to-Hindi translations for text blocks.",
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            translations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  translatedText: { type: Type.STRING },
                },
                required: ["id", "translatedText"],
              },
            },
          },
          required: ["translations"],
        },
      },
    });

    const text = response.text();
    if (!text) {
      throw new Error("No response generated from AI model");
    }

    const parsed = cleanAndParseJson(text);
    const translationMap = new Map<string, string>();
    (parsed.translations || []).forEach((t: any) => {
      translationMap.set(t.id, t.translatedText || "");
    });

    const translatedBlocks = blocks.map((b: any) => ({
      ...b,
      translatedText: translationMap.get(b.id) || b.originalText,
    }));

    res.json({ blocks: translatedBlocks });
  } catch (error: any) {
    console.error("Text Translation API error:", error);
    res.status(500).json({
      error: error.message || "Failed to translate text blocks",
    });
  }
});

// Translate PDF Page API using Gemini 3.6 Flash Vision OCR + Layout Extraction + Hindi Translation
app.post("/api/translate-page", async (req, res) => {
  try {
    const { imageBase64, pageNumber, totalPages } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "imageBase64 is required" });
    }

    // Strip header prefix if present (data:image/png;base64,...)
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const ai = getGenAI();

    const prompt = `You are an expert OCR, document layout analysis, and English-to-Hindi translator AI.
Examine this image of PDF page ${pageNumber || 1} of ${totalPages || 1}.
Perform the following tasks:
1. Locate all primary text paragraphs, headings, labels, and captions on this page. Combine lines that belong to the same logical paragraph into a single block to keep paragraphs intact.
2. For each distinct paragraph block, provide:
   - Bounding box [ymin, xmin, ymax, xmax] on a scale of 0 to 1000 representing its exact position on the page image.
   - The exact original English text contained in this paragraph.
   - The fluent, accurate Hindi translation (in Devanagari script) of the paragraph.
   - Estimated font size in points/pixels relative to a standard 1000x1000 box.
   - Text alignment ('left', 'center', 'right', or 'justify').
   - Main background color behind text (HEX string like "#FFFFFF").
   - Text color (HEX string like "#000000").
   - Flag whether it is a heading or title (boolean).

Return strict JSON adhering to the schema.`;

    const response = await generateContentWithRetry(ai, {
      contents: [
        {
          inlineData: {
            mimeType: "image/png",
            data: cleanBase64,
          },
        },
        {
          text: prompt,
        },
      ],
      config: {
        systemInstruction: "You strictly output accurate OCR layout and English-to-Hindi translations with precise bounding boxes normalized 0-1000.",
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            blocks: {
              type: Type.ARRAY,
              description: "Array of detected text blocks and paragraphs",
              items: {
                type: Type.OBJECT,
                properties: {
                  ymin: { type: Type.NUMBER, description: "Top coordinate 0-1000" },
                  xmin: { type: Type.NUMBER, description: "Left coordinate 0-1000" },
                  ymax: { type: Type.NUMBER, description: "Bottom coordinate 0-1000" },
                  xmax: { type: Type.NUMBER, description: "Right coordinate 0-1000" },
                  originalText: { type: Type.STRING, description: "Original English paragraph text" },
                  translatedText: { type: Type.STRING, description: "Fluent Hindi translation in Devanagari" },
                  fontSize: { type: Type.NUMBER, description: "Estimated font size" },
                  alignment: { type: Type.STRING, description: "left, center, right, or justify" },
                  bgColor: { type: Type.STRING, description: "Hex background color, e.g. #FFFFFF" },
                  textColor: { type: Type.STRING, description: "Hex text color, e.g. #000000" },
                  isHeading: { type: Type.BOOLEAN, description: "True if heading or title" },
                },
                required: ["ymin", "xmin", "ymax", "xmax", "originalText", "translatedText"],
              },
            },
          },
          required: ["blocks"],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response generated from Gemini API");
    }

    const result = cleanAndParseJson(text);
    
    // Normalize response blocks to include block IDs and formatted structure
    const formattedBlocks = (result.blocks || []).map((b: any, idx: number) => ({
      id: `block-${pageNumber || 1}-${idx}-${Date.now()}`,
      box: {
        ymin: Math.min(Math.max(Number(b.ymin) || 0, 0), 1000),
        xmin: Math.min(Math.max(Number(b.xmin) || 0, 0), 1000),
        ymax: Math.min(Math.max(Number(b.ymax) || 0, 0), 1000),
        xmax: Math.min(Math.max(Number(b.xmax) || 0, 0), 1000),
      },
      originalText: b.originalText || "",
      translatedText: b.translatedText || "",
      fontSize: Number(b.fontSize) || 16,
      alignment: b.alignment || "left",
      bgColor: b.bgColor || "#FFFFFF",
      textColor: b.textColor || "#000000",
      isHeading: Boolean(b.isHeading),
    }));

    res.json({
      pageNumber: pageNumber || 1,
      blocks: formattedBlocks,
    });
  } catch (error: any) {
    console.error("Translation API Error:", error);
    res.status(500).json({
      error: error.message || "Failed to process PDF page translation",
    });
  }
});

async function startServer() {
  // Vite middleware for development vs static in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PDF Translator server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
