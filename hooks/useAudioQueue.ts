import React, { useState, useMemo, useCallback } from 'react';
import { AudioQueueItem, ParagraphDataStatus } from '../types';
import { audioBufferToWavBlob } from '../utils/audio';

export const useAudioQueue = (audioContextRef: React.MutableRefObject<AudioContext | null>, logMessage: (msg: string, data?: any) => void) => {
  const [audioQueue, setAudioQueue] = useState<AudioQueueItem[]>([]);
  const [currentParagraphId, setCurrentParagraphId] = useState<number | null>(null);
  const [waitingForParagraphId, setWaitingForParagraphId] = useState<number | null>(null);
  
  const [isProcessingText, setIsProcessingText] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // App State: 'input' means editing text, 'playback' means queue is active
  const [appState, setAppState] = useState<'input' | 'playback'>('input');

  const resetQueue = useCallback(() => {
    setAudioQueue([]);
    setCurrentParagraphId(null);
    setWaitingForParagraphId(null);
    setAppState('input');
  }, []);

  // Download Logic
  const isDownloadReady = useMemo(() => 
    audioQueue.length > 0 && audioQueue.every(item => item.status === ParagraphDataStatus.READY),
    [audioQueue]
  );

  const handleDownload = async () => {
    if (!isDownloadReady) {
      const failedItems = audioQueue.filter(i => i.status === ParagraphDataStatus.FAILED);
      const pendingItems = audioQueue.filter(i => i.status === ParagraphDataStatus.FETCHING || i.status === ParagraphDataStatus.QUEUED);
      
      let msg = "Cannot download yet:\n";
      if (failedItems.length > 0) msg += `- ${failedItems.length} paragraph(s) failed. Please retry them.\n`;
      if (pendingItems.length > 0) msg += `- ${pendingItems.length} paragraph(s) are still processing.\n`;
      
      alert(msg);
      return;
    }

    setIsDownloading(true);
    logMessage("Merging audio buffers...");
    
    try {
      if (!audioContextRef.current) throw new Error("AudioContext not available.");
      
      const buffers = audioQueue.map(item => item.audioBuffer).filter((b): b is AudioBuffer => b !== null);
      if (buffers.length === 0) throw new Error("No audio to download.");

      const totalLength = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
      const concatenatedBuffer = audioContextRef.current.createBuffer(
        1,
        totalLength,
        audioContextRef.current.sampleRate
      );
      
      const channelData = concatenatedBuffer.getChannelData(0);
      let offset = 0;
      for (const buffer of buffers) {
        channelData.set(buffer.getChannelData(0), offset);
        offset += buffer.length;
      }
      
      const wavBlob = audioBufferToWavBlob(concatenatedBuffer);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'speech.wav';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      logMessage("File downloaded successfully.");
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logMessage(errorMessage);
        alert(`Download failed: ${errorMessage}`);
    } finally {
        setIsDownloading(false);
    }
  };

  return {
    audioQueue, setAudioQueue,
    currentParagraphId, setCurrentParagraphId,
    waitingForParagraphId, setWaitingForParagraphId,
    isProcessingText, setIsProcessingText,
    isDownloading,
    appState, setAppState,
    resetQueue,
    isDownloadReady,
    handleDownload
  };
};