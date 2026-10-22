/**
 * Service to interact with the backend Gemini endpoints for text processing and speech generation.
 * Uses active models:
 * - gemini-3.8-flash for text segmentation and transliteration
 * - gemini-3.8-flash-lite-tts for speech synthesis
 */

/**
 * Takes raw text and a system instruction to produce an array of TTS-optimized text chunks.
 * Calls the backend /api/process-text endpoint powered by gemini-3.8-flash.
 *
 * @param originalText The raw user input text.
 * @param systemInstruction The system instruction guiding the model's segmentation process.
 * @returns A promise that resolves to an array of TTS-ready chunks.
 */
export async function processTextForPlayback(
  originalText: string,
  systemInstruction: string
): Promise<string[]> {
  try {
    const response = await fetch('/api/process-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: originalText,
        systemInstruction,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Server responded with status ${response.status}`);
    }

    if (!Array.isArray(data.chunks)) {
      throw new Error('Invalid response structure: chunks array expected.');
    }

    return data.chunks;
  } catch (error) {
    console.error('Error during text segmentation processing:', error);
    let errorMessage = 'Failed to process text. ';
    if (error instanceof Error) {
      errorMessage += error.message;
    } else {
      errorMessage += String(error);
    }
    throw new Error(errorMessage);
  }
}

/**
 * Calls the Gemini Text-to-Speech (TTS) backend endpoint to generate speech from a given text string.
 * Calls the backend /api/generate-speech endpoint powered by gemini-3.8-flash-lite-tts.
 *
 * @param text - The plain text to be converted to speech.
 * @returns A Promise that resolves to the base64-encoded audio data string.
 */
export async function generateSpeech(text: string): Promise<string> {
  const response = await fetch('/api/generate-speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      // Voice: 'Kore' provides natural pronunciation for multilingual and Persian text
      voiceName: 'Kore',
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Server responded with status ${response.status}`);
  }

  if (!data.audio) {
    throw new Error('No audio data received from speech endpoint.');
  }

  return data.audio;
}