import { useRef, useState, useCallback, useEffect } from 'react';

export const useAudioPlayer = (playbackSpeed: number, logMessage: (msg: string) => void) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Sync playback speed with Audio Element
  useEffect(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContext({ sampleRate: 24000 });
        logMessage('AudioContext initialized.');
        return true;
      } catch (e) {
        logMessage('Web Audio API not supported.');
        alert('Web Audio API is not supported by this browser.');
        return false;
      }
    }
    return true;
  }, [logMessage]);

  const closeAudioContext = useCallback(() => {
    if (audioContextRef.current) {
      logMessage('Closing AudioContext to release hardware resources.');
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, [logMessage]);

  const stopPlayback = useCallback(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.src = '';
    }
    closeAudioContext();
    setIsPaused(false);
  }, [closeAudioContext]);

  // Handlers for native audio events
  const handleAudioPlay = useCallback(() => setIsPaused(false), []);
  const handleAudioPause = useCallback(() => setIsPaused(true), []);

  const togglePlayPause = useCallback(() => {
    if (!audioPlayerRef.current) return;
    if (audioPlayerRef.current.paused) {
      audioPlayerRef.current.play().catch(e => logMessage(`Playback Error: ${e.message}`));
    } else {
      audioPlayerRef.current.pause();
    }
  }, [logMessage]);

  return {
    audioContextRef,
    audioPlayerRef,
    isPaused,
    setIsPaused,
    initAudioContext,
    stopPlayback,
    handleAudioPlay,
    handleAudioPause,
    togglePlayPause,
  };
};