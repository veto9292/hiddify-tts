import React, { useRef } from 'react';
import { PlayIcon, PauseIcon, StopIcon, DownloadIcon, SpinnerIcon, PreviousIcon } from './icons';

interface ControlPanelProps {
  currentParagraphId: number | null;
  waitingForParagraphId: number | null;
  isPaused: boolean;
  onPlayPause: () => void;
  onPrevious: () => void;
  isPreviousReady: boolean;
  onStop: () => void;
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;
  isDownloading: boolean;
  isDownloadReady: boolean;
  onDownload: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  currentParagraphId, waitingForParagraphId, isPaused,
  onPlayPause, onPrevious, isPreviousReady, onStop, playbackSpeed, setPlaybackSpeed,
  isDownloading, isDownloadReady, onDownload
}) => {
  const speedLongPressTimerRef = useRef<number | null>(null);
  const speedLevels = [1.0, 1.2, 1.5, 1.8, 2.0];

  const handleCycleSpeed = () => {
      const currentIndex = speedLevels.indexOf(playbackSpeed);
      const nextIndex = (currentIndex + 1) % speedLevels.length;
      setPlaybackSpeed(speedLevels[nextIndex]);
  };
  
  const clearSpeedLongPressTimer = () => {
    if (speedLongPressTimerRef.current) {
        clearTimeout(speedLongPressTimerRef.current);
        speedLongPressTimerRef.current = null;
    }
  };

  const handleSpeedMouseDown = () => {
      clearSpeedLongPressTimer();
      speedLongPressTimerRef.current = window.setTimeout(() => {
          setPlaybackSpeed(1.0);
          speedLongPressTimerRef.current = null; // Mark as fired
      }, 500);
  };

  const handleSpeedMouseUp = () => {
      if (speedLongPressTimerRef.current !== null) {
          clearSpeedLongPressTimer();
          handleCycleSpeed();
      }
  };

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700/50 shadow-lg w-full flex items-center justify-between px-3 py-2">
        
        {/* Left Side: Playback Controls */}
        <div className="flex items-center gap-2">
            
            {/* Previous */}
             <button 
                onClick={onPrevious} 
                disabled={!isPreviousReady}
                className="w-9 h-9 bg-gray-700 hover:bg-gray-600 rounded-full flex justify-center items-center text-gray-300 hover:text-white transition-all shadow-sm active:scale-95 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed disabled:shadow-none"
                title="Previous Paragraph"
            >
                <PreviousIcon className="w-4 h-4" />
            </button>

            {/* Play/Pause */}
            <button 
                onClick={onPlayPause} 
                disabled={waitingForParagraphId !== null || currentParagraphId === null} 
                className="w-9 h-9 bg-blue-600 hover:bg-blue-500 rounded-full flex justify-center items-center text-white transition-all shadow-md active:scale-95 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed disabled:shadow-none"
                title={isPaused ? "Play" : "Pause"}
            >
                {isPaused || currentParagraphId === null ? <PlayIcon className="w-4 h-4 fill-current" /> : <PauseIcon className="w-4 h-4 fill-current" />}
            </button>
            
            {/* Stop */}
            <button 
                onClick={onStop} 
                className="w-9 h-9 bg-gray-700 hover:bg-red-500/80 hover:text-white rounded-full flex justify-center items-center text-gray-300 transition-all shadow-sm active:scale-95"
                title="Stop"
            >
                <StopIcon className="w-4 h-4" />
            </button>

             <div className="w-px h-5 bg-gray-700 mx-1"></div>

            {/* Speed Control */}
            <button
                onMouseDown={handleSpeedMouseDown}
                onMouseUp={handleSpeedMouseUp}
                onMouseLeave={clearSpeedLongPressTimer}
                className="px-2 py-1.5 hover:bg-gray-700/50 text-gray-300 hover:text-white font-mono text-xs font-bold rounded transition-colors"
                title="Click to cycle speed, long press to reset to 1.0x"
            >
                {playbackSpeed.toFixed(1)}x
            </button>
        </div>

        {/* Right Side: Download */}
        <div>
            <button
                onClick={onDownload}
                disabled={isDownloading || !isDownloadReady}
                className={`
                    w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-sm active:scale-95
                    ${isDownloadReady 
                        ? 'bg-gray-700 hover:bg-green-600 hover:text-white text-gray-300 cursor-pointer' 
                        : 'bg-gray-800 text-gray-600 cursor-not-allowed'}
                `}
                title={isDownloadReady ? "Download WAV" : "Wait for completion"}
            >
                {isDownloading ? <SpinnerIcon className="w-4 h-4"/> : <DownloadIcon className="w-4 h-4" />}
            </button>
        </div>
    </div>
  );
};