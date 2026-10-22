import React, { useCallback, useEffect, useState } from 'react';
import { ParagraphDataStatus, AudioQueueItem } from '../types';
import { processTextForPlayback } from '../services/geminiService';
import { audioBufferToWavBlob } from '../utils/audio';
import { sanitizeForTTS } from '../utils/textProcessing';

// Import composed hooks
import { useLogger } from './useLogger';
import { useAudioSettings } from './useAudioSettings';
import { useAudioPlayer } from './useAudioPlayer';
import { useAudioQueue } from './useAudioQueue';
import { useAudioFetcher } from './useAudioFetcher';

/**
 * Main application hook that acts as the Controller.
 * It orchestrates the UI state, Audio Logic, API calls, and Event handling.
 */
export const useAudioApp = () => {
  // 1. Logging
  const { logs, logMessage, clearLogs } = useLogger();

  // 2. Settings (Text, Speed, Direction)
  const {
    text, setText,
    systemInstruction, setSystemInstruction,
    direction, setDirection,
    computedDirection,
    playbackSpeed, setPlaybackSpeed,
    maxConcurrentFetches, setMaxConcurrentFetches
  } = useAudioSettings();

  // 3. Audio Player (Context, Refs, Play/Pause)
  const {
    audioContextRef,
    audioPlayerRef,
    isPaused,
    setIsPaused,
    initAudioContext,
    stopPlayback,
    handleAudioPlay,
    handleAudioPause,
    togglePlayPause
  } = useAudioPlayer(playbackSpeed, logMessage);

  // 4. Queue Management (State, Download)
  const {
    audioQueue, setAudioQueue,
    currentParagraphId, setCurrentParagraphId,
    waitingForParagraphId, setWaitingForParagraphId,
    isProcessingText, setIsProcessingText,
    isDownloading,
    appState, setAppState,
    resetQueue,
    isDownloadReady,
    handleDownload
  } = useAudioQueue(audioContextRef, logMessage);

  // 5. Fetcher Logic (Concurrency, Retries, Session Management)
  const {
    invalidateSession,
    startNewSession,
    getCurrentSessionId
  } = useAudioFetcher({
    audioQueue,
    setAudioQueue,
    appState,
    maxConcurrentFetches,
    audioContextRef,
    logMessage
  });

  // --- Visibility Toggle (Local UI state) ---
  const [showLogs, setShowLogs] = useState(false);

  // --- Logic Integration ---

  /**
   * Stops playback and resets the application state.
   */
  const handleStop = useCallback(() => {
    stopPlayback();
    invalidateSession();
    resetQueue();
    clearLogs();
    setShowLogs(false);
  }, [stopPlayback, invalidateSession, resetQueue, clearLogs]);

  /**
   * Plays a specific paragraph by ID.
   */
  const playAudio = useCallback((id: number) => {
    setWaitingForParagraphId(null);
    const item = audioQueue.find(i => i.id === id);

    // Case 1: Audio is ready
    if (item?.audioBuffer && audioPlayerRef.current) {
      logMessage(`Starting playback for Paragraph ${id}.`);
      
      const wavBlob = audioBufferToWavBlob(item.audioBuffer);
      const url = URL.createObjectURL(wavBlob);
      
      audioPlayerRef.current.src = url;
      audioPlayerRef.current.playbackRate = playbackSpeed;
      audioPlayerRef.current.play().catch(e => logMessage(`Playback Error: ${e.message}`));
      
      setCurrentParagraphId(id);
      setIsPaused(false);
    } 
    // Case 2: Ready but empty (Skip)
    else if (item?.status === ParagraphDataStatus.READY && item.audioBuffer === null) {
      logMessage(`Paragraph ${id} is empty (skipped). Moving to next.`);
      const nextId = id + 1;
      if (nextId < audioQueue.length) {
        playAudio(nextId);
      } else {
        handleStop(); // End of queue
      }
    }
    // Case 3: Not ready
    else {
        logMessage(`Attempted to play Paragraph ${id} but it wasn't ready.`);
    }
  }, [audioQueue, playbackSpeed, handleStop, logMessage, setCurrentParagraphId, setWaitingForParagraphId, setIsPaused, audioPlayerRef]);

  /**
   * Audio Ended Event Handler - Navigation Logic
   */
  const handleAudioEnded = useCallback(() => {
    if (currentParagraphId === null) return;
    
    const nextId = currentParagraphId + 1;
    
    if (nextId < audioQueue.length) {
      const nextItem = audioQueue.find(i => i.id === nextId);
      
      if (nextItem?.status === ParagraphDataStatus.READY) {
        playAudio(nextId);
      } else {
        logMessage(`Paragraph ${nextId} is not ready yet. Buffering...`);
        setWaitingForParagraphId(nextId);
        setCurrentParagraphId(null);
      }
    } else {
      logMessage('Reached end of queue. Finishing.');
      handleStop();
    }
  }, [currentParagraphId, audioQueue, playAudio, handleStop, logMessage, setWaitingForParagraphId, setCurrentParagraphId]);

  /**
   * Auto-resume logic when waiting paragraph becomes ready
   */
  useEffect(() => {
    if (waitingForParagraphId !== null) {
      const itemToPlay = audioQueue.find(item => item.id === waitingForParagraphId);
      if (itemToPlay?.status === ParagraphDataStatus.READY) {
        logMessage(`P.${waitingForParagraphId} is now ready. Resuming.`);
        playAudio(itemToPlay.id);
      }
    }
  }, [audioQueue, waitingForParagraphId, logMessage, playAudio]);

  /**
   * Auto-play first paragraph
   */
  useEffect(() => {
    if (appState === 'playback' && currentParagraphId === null && waitingForParagraphId === null) {
      const firstParagraph = audioQueue.find(item => item.id === 0);
      if (firstParagraph?.status === ParagraphDataStatus.READY) {
        playAudio(firstParagraph.id);
      }
    }
  }, [appState, audioQueue, currentParagraphId, waitingForParagraphId, playAudio]);

  /**
   * Main Generator Function
   */
  const handleGenerateAndPlay = useCallback(async () => {
    setCurrentParagraphId(null);
    setIsPaused(false);
    setWaitingForParagraphId(null);
    setIsProcessingText(true);
    setShowLogs(false);
    
    const currentSessionId = startNewSession();
    clearLogs();

    if (!initAudioContext()) {
      setIsProcessingText(false);
      return;
    }

    // Process Text
    let ttsChunks: string[];
    try {
      logMessage('Sending text for segmentation...');
      ttsChunks = await processTextForPlayback(text, systemInstruction);
      
      if (getCurrentSessionId() !== currentSessionId) {
        logMessage('Text processing completed, but session was cancelled. Discarding results.');
        return;
      }

      if (ttsChunks.length === 0) {
        logMessage('Warning: No text generated.');
        alert("The provided text could not be segmented.");
        setIsProcessingText(false);
        return;
      }
      logMessage(`Text split into ${ttsChunks.length} paragraphs.`);
    } catch (error) {
      if (getCurrentSessionId() !== currentSessionId) return;
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      logMessage(`Error: Text processing failed: ${errorMessage}`);
      alert(`Error: ${errorMessage}`);
      setIsProcessingText(false);
      return;
    }
    
    setIsProcessingText(false);

    // Build Queue
    const initialQueue: AudioQueueItem[] = ttsChunks.map((ttsChunk, index) => {
      const sanitizedText = sanitizeForTTS(ttsChunk);
      return {
        id: index,
        text: sanitizedText,
        displayText: ttsChunk,
        status: ParagraphDataStatus.QUEUED,
        audioBuffer: null,
      };
    });

    setAudioQueue(initialQueue);
    setAppState('playback');
  }, [text, systemInstruction, startNewSession, getCurrentSessionId, clearLogs, initAudioContext, logMessage, setIsProcessingText, setAudioQueue, setAppState, setCurrentParagraphId, setIsPaused, setWaitingForParagraphId]);

  const handleCancelProcessing = useCallback(() => {
    invalidateSession();
    logMessage(`Text processing cancelled by user.`);
    setIsProcessingText(false);
  }, [invalidateSession, logMessage, setIsProcessingText]);

  const handleRetry = useCallback((itemId: number) => {
    logMessage(`Retrying P.${itemId}`);
    setAudioQueue(prev => prev.map(item =>
      item.id === itemId 
        ? { ...item, status: ParagraphDataStatus.QUEUED, fetchStartTime: undefined, fetchDuration: undefined } 
        : item
    ));
  }, [logMessage, setAudioQueue]);

  return {
    text, setText,
    appState,
    audioQueue,
    isPaused,
    currentParagraphId,
    waitingForParagraphId,
    playbackSpeed, setPlaybackSpeed,
    direction, setDirection,
    computedDirection,
    logs,
    showLogs, setShowLogs,
    isDownloading,
    maxConcurrentFetches, setMaxConcurrentFetches,
    isProcessingText,
    systemInstruction, setSystemInstruction,
    audioPlayerRef,
    handleGenerateAndPlay,
    handleStop,
    handlePlayPause: togglePlayPause,
    handleAudioPlay,
    handleAudioPause,
    playAudio,
    handleAudioEnded,
    handleRetry,
    handleDownload,
    handleCancelProcessing,
    logMessage, // Exposed if needed
  };
};