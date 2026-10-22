
/**
 * Represents the data fetching lifecycle of a single paragraph in the audio queue.
 */
export enum ParagraphDataStatus {
  /** The paragraph is waiting in the queue to be fetched. */
  QUEUED = 'queued',
  /** An active network request is in progress to fetch the audio data. */
  FETCHING = 'fetching',
  /** The audio data has been successfully fetched and is ready for playback. */
  READY = 'ready',
  /** The network request to fetch the audio failed. */
  FAILED = 'failed',
}

/**
 * Defines the structure for an item in the audio processing queue.
 */
export interface AudioQueueItem {
  id: number;
  text: string;
  displayText: string;
  status: ParagraphDataStatus;
  audioBuffer: AudioBuffer | null;
  fetchStartTime?: number;
  fetchDuration?: number;
}

/**
 * Defines the user-configurable modes for text directionality.
 */
export type DirectionMode = 'auto' | 'ltr' | 'rtl';
