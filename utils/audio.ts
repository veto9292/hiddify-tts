/**
 * This module contains utility functions for handling audio data, including
 * decoding base64 strings, decoding raw PCM data into playable buffers, and
 * encoding those buffers into a standard WAV file format.
 */

/**
 * Decodes a base64 string into a Uint8Array of bytes.
 * @param base64 The base64-encoded string.
 * @returns A Uint8Array containing the decoded binary data.
 */
export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes raw PCM audio data (as a Uint8Array) into an AudioBuffer for playback.
 * This is necessary to convert the raw audio stream from the Gemini API into a
 * format that the Web Audio API can understand and manipulate.
 * @param data The raw PCM audio data.
 * @param ctx The Web Audio API AudioContext.
 * @param sampleRate The sample rate of the audio (e.g., 24000).
 * @param numChannels The number of audio channels (e.g., 1 for mono).
 * @returns A Promise that resolves to a playable AudioBuffer.
 */
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  // Check if data starts with 'RIFF' and contains 'WAVE' (standard WAV container)
  const isWav =
    data.length >= 12 &&
    data[0] === 0x52 && // R
    data[1] === 0x49 && // I
    data[2] === 0x46 && // F
    data[3] === 0x46 && // F
    data[8] === 0x57 && // W
    data[9] === 0x41 && // A
    data[10] === 0x56 && // V
    data[11] === 0x45; // E

  if (isWav) {
    // Standard WAV file: decode using the browser's native decodeAudioData
    const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    return await ctx.decodeAudioData(arrayBuffer);
  }

  // Fallback: 16-bit PCM (little-endian)
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, Math.floor(data.byteLength / 2));
  const frameCount = Math.floor(dataInt16.length / numChannels);
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  // Copy the PCM data into the AudioBuffer, converting it from 16-bit integer
  // to the required 32-bit float format (ranging from -1.0 to 1.0).
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Converts an AudioBuffer to a WAV file Blob.
 *
 * This is a critical step because the standard HTML `<audio>` element cannot play
 * raw PCM data directly. By wrapping the PCM data in a valid WAV container, we can
 * use a Blob URL as the `src` for an `<audio>` element. This allows us to leverage
 * its native playback capabilities and, most importantly, its `preservesPitch`
 * property, which enables high-quality, speed-adjusted playback without the
 * distorted "chipmunk effect" that occurs when speeding up raw audio.
 *
 * @param buffer The AudioBuffer containing the decoded PCM data.
 * @returns A Blob representing a complete WAV file.
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM - Linear quantization
  const bitDepth = 16;
  const pcmData = buffer.getChannelData(0); // Assuming mono for simplicity
  const dataLength = pcmData.length * (bitDepth / 8);
  const bufferLength = 44 + dataLength; // 44 bytes for the header

  const view = new DataView(new ArrayBuffer(bufferLength));

  // Helper function to write a string to the DataView.
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // --- WAV Header Construction ---

  // RIFF chunk descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true); // (file size - 8)
  writeString(8, 'WAVE');

  // "fmt " sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Sub-chunk size (16 for PCM)
  view.setUint16(20, format, true); // Audio format
  view.setUint16(22, numChannels, true); // Number of channels
  view.setUint32(24, sampleRate, true); // Sample rate
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true); // Byte rate
  view.setUint16(32, numChannels * (bitDepth / 8), true); // Block align
  view.setUint16(34, bitDepth, true); // Bits per sample

  // "data" sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataLength, true); // Sub-chunk size (data length)

  // --- PCM Data Section ---
  // Write the PCM data from the AudioBuffer, converting it from 32-bit float to 16-bit integer.
  let offset = 44;
  for (let i = 0; i < pcmData.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, pcmData[i]));
    // Scale the float to the 16-bit integer range.
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}