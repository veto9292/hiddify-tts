import React, { useCallback, useEffect, useRef } from 'react';
import { AudioQueueItem, ParagraphDataStatus } from '../types';
import { generateSpeech } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audio';

/**
 * Polyfill-like implementation of Promise.any
 */
async function promiseAny<T>(promises: Promise<T>[]): Promise<T> {
  return new Promise((resolve, reject) => {
    let rejectedCount = 0;
    const errors: any[] = [];
    const total = promises.length;

    if (total === 0) {
      return reject(new Error("No promises passed"));
    }

    promises.forEach((p, index) => {
      Promise.resolve(p).then(resolve).catch(err => {
        errors[index] = err;
        rejectedCount++;
        if (rejectedCount === total) {
          reject(new Error("All promises rejected: " + errors.map(e => String(e)).join(", ")));
        }
      });
    });
  });
}

interface UseAudioFetcherProps {
  audioQueue: AudioQueueItem[];
  setAudioQueue: React.Dispatch<React.SetStateAction<AudioQueueItem[]>>;
  appState: 'input' | 'playback';
  maxConcurrentFetches: number;
  audioContextRef: React.MutableRefObject<AudioContext | null>;
  logMessage: (msg: string, data?: any) => void;
}

export const useAudioFetcher = ({
  audioQueue,
  setAudioQueue,
  appState,
  maxConcurrentFetches,
  audioContextRef,
  logMessage
}: UseAudioFetcherProps) => {
  
  // Session ID to handle "stale" fetch requests when Stop/Reset is clicked
  const generationSessionIdRef = useRef(0);
  
  // FIX: Track IDs that have actively started fetching but haven't updated state yet.
  // This prevents the useEffect from firing double requests for the same ID 
  // due to React StrictMode or state update batching latency.
  const inFlightIdsRef = useRef(new Set<number>());

  const invalidateSession = useCallback(() => {
    generationSessionIdRef.current += 1;
    inFlightIdsRef.current.clear();
    logMessage(`Session invalidated. In-flight requests will be ignored.`);
  }, [logMessage]);

  const startNewSession = useCallback(() => {
    generationSessionIdRef.current += 1;
    inFlightIdsRef.current.clear();
    logMessage(`Starting Generation Session #${generationSessionIdRef.current}`);
    return generationSessionIdRef.current;
  }, [logMessage]);

  const getCurrentSessionId = useCallback(() => generationSessionIdRef.current, []);

  /**
   * Helper function to perform the actual API call and decoding for a single item.
   * Implements robust parallel retry logic with INFINITE PERSISTENCE.
   */
  const fetchAndDecodeAudio = useCallback(async (item: AudioQueueItem, sessionId: number) => {
    // If sessionId changed, abort immediately
    if (generationSessionIdRef.current !== sessionId) {
         return { ...item, status: ParagraphDataStatus.FAILED, audioBuffer: null };
    }

    if (item.text.length === 0) {
      logMessage(`P.${item.id} is empty after sanitization. Skipping API call.`);
      return { ...item, status: ParagraphDataStatus.READY, audioBuffer: null };
    }

    const performFetch = async (attemptLabel: string): Promise<AudioBuffer> => {
        if (generationSessionIdRef.current !== sessionId) throw new Error("Session Invalidated (Pre-fetch)");

        const base64Audio = await generateSpeech(item.text);
        
        if (generationSessionIdRef.current !== sessionId) throw new Error("Session Invalidated (Post-fetch)");

        const rawAudio = decode(base64Audio);
        if (!audioContextRef.current) throw new Error("AudioContext lost");
        return await decodeAudioData(rawAudio, audioContextRef.current, 24000, 1);
    };

    let attemptCount = 0;

    // RETRY LOOP
    while (true) {
        if (generationSessionIdRef.current !== sessionId) {
             return { ...item, status: ParagraphDataStatus.FAILED, audioBuffer: null };
        }

        attemptCount++;

        try {
            // Hedged Request Strategy
            const primaryPromise = performFetch(`primary-${attemptCount}`);
            const timeoutPromise = new Promise<'TIMEOUT'>((resolve) => setTimeout(() => resolve('TIMEOUT'), 30000));

            const raceResult = await Promise.race([primaryPromise, timeoutPromise]);

            if (raceResult === 'TIMEOUT') {
                logMessage(`P.${item.id} (Attempt ${attemptCount}) taking >30s. Initiating parallel retry.`);
                const secondaryPromise = performFetch(`secondary-${attemptCount}`);
                const winner = await promiseAny([primaryPromise, secondaryPromise]);
                logMessage(`P.${item.id} Parallel retry resolved successfully.`);
                return { ...item, status: ParagraphDataStatus.READY, audioBuffer: winner };
            } else {
                logMessage(`P.${item.id} Ready.`);
                return { ...item, status: ParagraphDataStatus.READY, audioBuffer: raceResult };
            }

        } catch (error) {
            const errStr = error instanceof Error ? error.message : String(error);
            
            if (generationSessionIdRef.current !== sessionId) {
                 return { ...item, status: ParagraphDataStatus.FAILED, audioBuffer: null };
            }

            // FIX: Don't retry on client errors (400 Bad Request) to avoid infinite loops on bad input.
            if (errStr.includes('400') || errStr.includes('INVALID_ARGUMENT')) {
                logMessage(`P.${item.id} Fatal Error (400): ${errStr}. Aborting retries.`);
                return { ...item, status: ParagraphDataStatus.FAILED, audioBuffer: null };
            }

            logMessage(`P.${item.id} Attempt ${attemptCount} failed: ${errStr}. Retrying in 5s...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
  }, [logMessage, audioContextRef]);

  /**
   * Concurrency Manager Effect
   */
  useEffect(() => {
    if (appState !== 'playback') return;

    const currentSessionId = generationSessionIdRef.current;
    
    // Calculate capacity
    const fetchingCount = audioQueue.filter(i => i.status === ParagraphDataStatus.FETCHING).length;
    
    // We must also count items that are technically "QUEUED" in state but "In Flight" in our ref
    // to prevent over-fetching capacity.
    const inFlightCount = inFlightIdsRef.current.size;
    
    // The true number of active slots used is roughly fetchingCount. 
    // However, during the race condition gap, fetchingCount is 0 but inFlightCount is > 0.
    // We use the greater of the two or just rely on itemsToFetch logic below.
    // Actually, simply filtering items that are NOT in inFlightIdsRef is enough to stop duplicates.
    
    const availableSlots = maxConcurrentFetches - fetchingCount;

    if (availableSlots <= 0) return;

    // Find items to fetch
    // FIX: Filter out items that are already in `inFlightIdsRef` to prevent double-fetching
    const itemsToFetch = audioQueue
      .filter(i => i.status === ParagraphDataStatus.QUEUED && !inFlightIdsRef.current.has(i.id))
      .slice(0, availableSlots);

    if (itemsToFetch.length === 0) return;

    // Mark them as fetching immediately in React State
    const now = Date.now();
    setAudioQueue(prevQueue =>
      prevQueue.map(item =>
        itemsToFetch.some(itf => itf.id === item.id)
          ? { ...item, status: ParagraphDataStatus.FETCHING, fetchStartTime: now }
          : item
      )
    );

    // Execute fetches
    itemsToFetch.forEach(item => {
      // FIX: Mark as in-flight immediately
      inFlightIdsRef.current.add(item.id);
      
      logMessage(`Starting fetch for P.${item.id}`);
      
      fetchAndDecodeAudio(item, currentSessionId).then(result => {
        // FIX: Remove from in-flight tracker when done (success or fail)
        inFlightIdsRef.current.delete(result.id);

        if (generationSessionIdRef.current !== currentSessionId) {
          logMessage(`Discarding result for P.${result.id} (Session Invalidated).`);
          return;
        }

        setAudioQueue(prevQueue =>
          prevQueue.map(qItem => {
            if (qItem.id === result.id) {
              const duration = Math.max(0, Date.now() - now);
              return { ...result, fetchDuration: duration };
            }
            return qItem;
          })
        );
      });
    });
  }, [audioQueue, appState, fetchAndDecodeAudio, maxConcurrentFetches, logMessage, setAudioQueue]);

  return {
    invalidateSession,
    startNewSession,
    getCurrentSessionId
  };
};