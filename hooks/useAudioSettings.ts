import { useState, useEffect } from 'react';
import { DirectionMode } from '../types';
import { detectDirection } from '../utils/textProcessing';
import { DEFAULT_TEXT, DEFAULT_SYSTEM_INSTRUCTION } from '../prompts';

export const useAudioSettings = () => {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [systemInstruction, setSystemInstruction] = useState(DEFAULT_SYSTEM_INSTRUCTION);
  const [direction, setDirection] = useState<DirectionMode>('auto');
  const [computedDirection, setComputedDirection] = useState<'ltr' | 'rtl'>('ltr');
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [maxConcurrentFetches, setMaxConcurrentFetches] = useState(3);

  // Effect: Auto-detect text direction
  useEffect(() => {
    if (direction === 'auto') {
      setComputedDirection(detectDirection(text));
    } else {
      setComputedDirection(direction);
    }
  }, [text, direction]);

  return {
    text, setText,
    systemInstruction, setSystemInstruction,
    direction, setDirection,
    computedDirection,
    playbackSpeed, setPlaybackSpeed,
    maxConcurrentFetches, setMaxConcurrentFetches,
  };
};