import { GoogleGenAI, Modality, HarmCategory, HarmBlockThreshold, Type } from "@google/genai";

let ai: GoogleGenAI | null = null;

/**
 * Lazily initializes and returns a singleton instance of the GoogleGenAI client.
 * This prevents the app from crashing on startup if the API key is not yet
 * available by deferring the client creation until it's actually needed. If the
 * API key is invalid, the error will be thrown at runtime and caught by the
 * calling function's error handler, instead of causing a fatal loading error.
 */
function getAiClient(): GoogleGenAI {
  if (!ai) {
    // The API key is sourced from process.env, which is injected at build time.
    // If it's missing, the constructor will throw an error, which will be
    // caught by the calling functions' try...catch blocks.
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return ai;
}

/**
 * Takes raw text and a system instruction to produce an array of TTS-optimized text chunks.
 * This function instructs the model to segment the original text faithfully without summarization,
 * returning a direct JSON array of strings.
 * @param originalText The raw user input text.
 * @param systemInstruction The system instruction guiding the model's segmentation process.
 * @returns A promise that resolves to an array of TTS-ready chunks.
 * @throws An error if the API call fails or the response is not a valid JSON array.
 */
export async function processTextForPlayback(
  originalText: string,
  systemInstruction: string
): Promise<string[]> {
  const aiClient = getAiClient();

  try {
    const response = await aiClient.models.generateContent({
      // DO NOT CHANGE THIS MODEL NAME. It must be 'gemini-3-flash-preview'.
      model: 'gemini-3-flash-preview',
      // Pass the raw text directly. The System Instruction now handles comment extraction.
      contents: originalText,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: systemInstruction,
        },
        // thinkingConfig: { thinkingBudget: 0 },
      },
    });

    // The response text is a JSON string representing an array.
    const rawTtsChunks = JSON.parse(response.text);

    // Basic validation to ensure the response is an array.
    if (!Array.isArray(rawTtsChunks)) {
      throw new Error("Invalid JSON structure received from API. Expected a direct array of strings.");
    }
    
    // Initial cleanup of strings
    const cleanedChunks = rawTtsChunks.map((s: unknown) => String(s).trim()).filter(Boolean);

    // We rely purely on the system instruction for segmentation length now.
    return cleanedChunks;

  } catch (error) {
    console.error("Error during text segmentation processing:", error);
    let errorMessage = "Failed to process text. ";
    if (error instanceof SyntaxError) {
      errorMessage += "The API did not return valid JSON.";
    } else if (error instanceof Error) {
      errorMessage += error.message;
    } else {
      errorMessage += String(error);
    }
    throw new Error(errorMessage);
  }
}


/**
 * Calls the Gemini Text-to-Speech (TTS) model to generate speech from a given text string.
 * The model will automatically detect the language from the provided text.
 * @param text - The plain text to be converted to speech.
 * @returns A Promise that resolves to the base64-encoded audio data as a string.
 * @throws An error if the API call fails or returns no audio data. The error message
 *         is formatted to be as informative as possible for logging purposes.
 */
export async function generateSpeech(text: string): Promise<string> {
  const aiClient = getAiClient();
  const speechConfig = {
    voiceConfig: {
      // The 'Sulafat' voice is used for both languages. The model adapts its
      // pronunciation and accent based on the language of the input text.
      prebuiltVoiceConfig: { voiceName: 'Sulafat' }
    }
  };
  
  // All errors, including API errors, are intentionally allowed to propagate up to the
  // caller (the retry logic in App.tsx), which is responsible for handling them.
  const response = await aiClient.models.generateContent({
    // Standardized to the recommended TTS model for consistency and reliability.
    model: 'gemini-2.5-flash-preview-tts',
    // The content is simply the text to be synthesized. The explicit language prompt
    // has been removed to allow the model to perform automatic language detection.
    contents: [{ parts: [{ text }] }],
    config: {
      // Specify that the desired response modality is audio.
      responseModalities: [Modality.AUDIO],
      speechConfig,
      // By setting a fixed seed, we make the model's output more deterministic.
      // This is crucial for ensuring the voice tone, pacing, and personality
      // remain consistent across multiple, independent API calls for each
      // paragraph, creating a cohesive listening experience.
      seed: 42,
      // Configure safety settings to be non-restrictive. For a TTS application,
      // the primary goal is to speak the user's input. Blocking content based on
      // safety filters would be counterproductive and lead to a poor user
      // experience with unexpected gaps in the audio. The responsibility for
      // the content lies with the user providing the text.
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

  // Safely access the audio data from the response.
  const candidate = response.candidates?.[0];
  const part = candidate?.content?.parts?.[0];

  if (part?.inlineData?.data) {
    return part.inlineData.data;
  }
  
  // If no audio data is found, construct a detailed error message to aid debugging.
  let errorMessage = "No audio data received from API.";
  if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
    errorMessage += ` Finish reason: ${candidate.finishReason}.`;
  }
  if (part?.text) {
    // Sometimes the API returns text instead of audio on failure.
    errorMessage += ` API returned text: "${part.text}"`;
  }

  throw new Error(errorMessage);
}