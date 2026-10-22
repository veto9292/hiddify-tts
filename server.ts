import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Modality, HarmCategory, HarmBlockThreshold, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy singleton initialization for GoogleGenAI with proper User-Agent header
let aiClientInstance: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClientInstance) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      console.warn("Warning: GEMINI_API_KEY / API_KEY is not defined in the environment.");
    }
    aiClientInstance = new GoogleGenAI({
      apiKey: apiKey || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClientInstance;
}

// Fallback rule-based paragraph splitter when all remote AI models are temporarily down with 503
function fallbackSegmentText(text: string): string[] {
  const rawBlocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const block of rawBlocks) {
    if (block.length <= 400) {
      chunks.push(block);
    } else {
      const sentences = block.split(/(?<=[.!?؛،\n])\s+/).filter(Boolean);
      let currentChunk = '';
      for (const sentence of sentences) {
        if ((currentChunk + ' ' + sentence).length > 400 && currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = sentence;
        } else {
          currentChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
        }
      }
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
    }
  }
  return chunks.length > 0 ? chunks : [text.trim()];
}

// Helper to execute API calls across model cascades with automatic retry for 503/429
async function executeWithCascade<T>(
  models: string[],
  action: (model: string) => Promise<T>
): Promise<{ result: T; usedModel: string }> {
  let lastError: any = null;

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await action(model);
        return { result, usedModel: model };
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || err);
        console.warn(`[Cascade] Model ${model} (attempt ${attempt + 1}) failed: ${msg}`);

        // If it's a 503 Service Unavailable / 429 / high demand error, retry briefly
        if (
          msg.includes('503') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('high demand') ||
          msg.includes('429') ||
          msg.includes('RESOURCE_EXHAUSTED')
        ) {
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 800));
            continue;
          }
        }
        // Move to next candidate model
        break;
      }
    }
  }

  throw lastError;
}

// 1. Endpoint: Process & Segment Text using active model cascade
app.post('/api/process-text', async (req: Request, res: Response) => {
  const { text, systemInstruction } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text input is required.' });
  }

  const ai = getAiClient();
  const instruction =
    systemInstruction ||
    'Convert the input text into a JSON Array of short segments optimized for TTS. Output must be a valid JSON array of strings.';

  // Cascade list of high-performance text models
  const TEXT_MODELS = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

  try {
    const { result: response, usedModel } = await executeWithCascade(TEXT_MODELS, async (model) => {
      return await ai.models.generateContent({
        model,
        contents: text,
        config: {
          systemInstruction: instruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Array of TTS-optimized text segments',
          },
        },
      });
    });

    const responseText = response.text || '[]';
    let rawTtsChunks: unknown;
    try {
      rawTtsChunks = JSON.parse(responseText);
    } catch {
      throw new Error('Model did not return valid JSON: ' + responseText);
    }

    if (!Array.isArray(rawTtsChunks)) {
      throw new Error('Model returned non-array JSON structure.');
    }

    const cleanedChunks = rawTtsChunks.map((s: unknown) => String(s).trim()).filter(Boolean);
    console.log(`[Success] Processed text into ${cleanedChunks.length} chunks using ${usedModel}`);
    return res.json({ chunks: cleanedChunks, model: usedModel });
  } catch (error: any) {
    console.error('All text models in cascade failed. Applying smart local fallback segmentation:', error?.message);
    // Safety net: segment locally so user is never blocked by temporary Gemini 503 service outages
    const fallbackChunks = fallbackSegmentText(text);
    return res.json({
      chunks: fallbackChunks,
      fallbackUsed: true,
      warning: 'Processed using fallback segmenter due to temporary upstream service demand.'
    });
  }
});

// 2. Endpoint: Generate Speech using active model cascade
app.post('/api/generate-speech', async (req: Request, res: Response) => {
  const { text, voiceName } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text is required for TTS.' });
  }

  const ai = getAiClient();
  const selectedVoice = voiceName || 'Kore';
  const TTS_MODELS = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'];

  try {
    const { result: response, usedModel } = await executeWithCascade(TTS_MODELS, async (model) => {
      return await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [{ text }],
          },
        ],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoice },
            },
          },
          seed: 42,
          safetySettings: [
            {
              category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
              threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_HARASSMENT,
              threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
              threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
              threshold: HarmBlockThreshold.BLOCK_NONE,
            },
          ],
        },
      });
    });

    const candidate = response.candidates?.[0];
    const part = candidate?.content?.parts?.[0];

    if (part?.inlineData?.data) {
      return res.json({
        audio: part.inlineData.data,
        mimeType: part.inlineData.mimeType || 'audio/wav',
        model: usedModel,
      });
    }

    let errorDetail = 'No audio data received from Gemini API.';
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      errorDetail += ` Finish reason: ${candidate.finishReason}.`;
    }
    if (part?.text) {
      errorDetail += ` Response text: ${part.text}`;
    }

    return res.status(502).json({ error: errorDetail });
  } catch (error: any) {
    console.error('Error in /api/generate-speech:', error);
    const message = error?.message || String(error);
    return res.status(500).json({ error: message });
  }
});

// Vite middleware integration for SPA dev server / production static files
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
