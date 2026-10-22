import React, { useEffect, useRef, useState } from 'react';
import { AudioQueueItem, ParagraphDataStatus } from '../types';
import { RetryIcon, StatusIcon, SpinnerIcon } from './icons';

interface StatusListProps {
  audioQueue: AudioQueueItem[];
  currentParagraphId: number | null;
  waitingForParagraphId: number | null;
  activeTab: string;
  isPlaying: boolean;
  computedDirection: 'ltr' | 'rtl';
  onPlayItem: (id: number) => void;
  onRetryItem: (id: number) => void;
}

/**
 * Renders the "Status" tab content.
 * Displays the list of paragraphs, their current state (Queue, Fetching, Ready),
 * and allows interaction (Play specific item, Retry failed item).
 */
export const StatusList: React.FC<StatusListProps> = ({
  audioQueue,
  currentParagraphId,
  waitingForParagraphId,
  activeTab,
  isPlaying,
  computedDirection,
  onPlayItem,
  onRetryItem
}) => {
  const paragraphRefs = useRef<Record<number, HTMLLIElement | null>>({});
  
  // Force re-render every second to update the "fetch duration" timer
  // for items currently in the 'fetching' state.
  const [, setTick] = useState(0);

  useEffect(() => {
    if (activeTab !== 'status') return;
    
    // Only run the interval if there is actually something fetching
    const hasFetchingItems = audioQueue.some(i => i.status === ParagraphDataStatus.FETCHING);
    if (!hasFetchingItems) return;

    const interval = window.setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTab, audioQueue]);

  // Auto-scroll to the active paragraph when it changes
  useEffect(() => {
    if (activeTab === 'status') {
      const paragraphIdToScroll = currentParagraphId ?? waitingForParagraphId;
      if (paragraphIdToScroll !== null) {
        paragraphRefs.current[paragraphIdToScroll]?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [currentParagraphId, waitingForParagraphId, activeTab]);

  if (activeTab !== 'status') return null;

  return (
    <div className="w-full h-full bg-gray-800 p-4 overflow-y-auto">
      <ul className="space-y-2">
        {audioQueue.map(item => (
          <li
            key={item.id}
            ref={el => { paragraphRefs.current[item.id] = el; }}
            onClick={() => {
              if (item.status === ParagraphDataStatus.READY) {
                onPlayItem(item.id);
              }
            }}
            className={`flex items-center justify-between p-2 rounded-md transition-all duration-300 ${
              currentParagraphId === item.id ? 'bg-blue-900/50' : 'bg-gray-700/50'
            } ${
              item.status === ParagraphDataStatus.READY ? 'cursor-pointer hover:bg-blue-900/40' : 'cursor-default'
            } ${
              waitingForParagraphId === item.id ? 'ring-2 ring-yellow-500' : ''
            }`}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Left Column: ID and Status/Timer */}
              <div className="flex-shrink-0 flex flex-col items-center justify-center w-12 gap-1">
                <span className="text-xs font-mono text-gray-400">P.{item.id.toString().padStart(2, '0')}</span>
                
                {item.status === ParagraphDataStatus.FAILED ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRetryItem(item.id);
                    }}
                    className="text-red-500 hover:text-red-400"
                    title="Retry Fetch"
                  >
                    <RetryIcon className="w-4 h-4" />
                  </button>
                ) : item.status === ParagraphDataStatus.FETCHING ? (
                   <button 
                      onClick={(e) => {
                          e.stopPropagation(); 
                          onRetryItem(item.id);
                      }}
                      className="relative w-7 h-7 flex items-center justify-center group"
                      title="Fetching... Click to retry/reset"
                  >
                    <SpinnerIcon className="absolute inset-0 w-full h-full text-blue-500 group-hover:text-yellow-500 transition-colors" />
                    <span className="relative z-10 text-[9px] font-mono font-bold text-gray-300 group-hover:text-white">
                      {Math.floor((Date.now() - (item.fetchStartTime || Date.now())) / 1000)}
                    </span>
                  </button>
                ) : (
                  <StatusIcon status={waitingForParagraphId === item.id ? 'fetching' : (currentParagraphId === item.id && isPlaying ? 'playing' : item.status)} />
                )}

                {/* Duration Display (Only if finished fetching) */}
                {item.fetchDuration !== undefined && (
                   <span className="text-[10px] font-mono text-gray-500 leading-none">
                      {(item.fetchDuration / 1000).toFixed(1)}s
                   </span>
                )}
              </div>

              {/* Right Column: Text Content */}
              <p dir={computedDirection} className="text-sm text-gray-300 min-w-0 flex-1 break-words">{item.displayText}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};