import React, { useState, useRef, useEffect } from 'react';
import { AudioQueueItem, DirectionMode, ParagraphDataStatus } from '../types';
import { MarkdownPreview } from './MarkdownPreview';
import { StatusList } from './StatusList';
import { RetryIcon, StatusIcon, SpinnerIcon, ExpandIcon, CloseIcon } from './icons';

interface PlaybackSectionProps {
  text: string;
  audioQueue: AudioQueueItem[];
  currentParagraphId: number | null;
  waitingForParagraphId: number | null;
  isPlaying: boolean;
  direction: DirectionMode;
  computedDirection: 'ltr' | 'rtl';
  onPlayItem: (id: number) => void;
  onRetryItem: (id: number) => void;
}

/**
 * A sub-component for the mini queue items to handle their own hover state and timer.
 */
const MiniQueueItem: React.FC<{
  item: AudioQueueItem;
  activeId: number;
  waitingForParagraphId: number | null;
  isPlaying: boolean;
  computedDirection: 'ltr' | 'rtl';
  onPlayItem: (id: number) => void;
  onRetryItem: (id: number) => void;
}> = ({ item, activeId, waitingForParagraphId, isPlaying, computedDirection, onPlayItem, onRetryItem }) => {
  
  const [isExpanded, setIsExpanded] = useState(false);
  const hoverTimerRef = useRef<number | null>(null);

  const handleMouseEnter = () => {
    // Set a timer to expand after 600ms
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = window.setTimeout(() => {
      setIsExpanded(true);
    }, 600);
  };

  const handleMouseLeave = () => {
    // Clear timer and reset state immediately
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = null;
    setIsExpanded(false);
  };

  const handleFocus = () => {
    // On focus (mobile tap or tab), expand immediately
    setIsExpanded(true);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const isCenter = item.id === activeId;
  const isWaiting = waitingForParagraphId === item.id;
  const isReady = item.status === ParagraphDataStatus.READY;

  return (
    <div 
      tabIndex={0}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleMouseLeave}
      onClick={() => isReady && onPlayItem(item.id)}
      dir={computedDirection}
      className={`
        relative outline-none
        rounded-md p-2 transition-all duration-200 flex items-center gap-3
        ${isCenter 
            ? 'bg-blue-900/30 ring-1 ring-blue-500/50' 
            : 'bg-transparent opacity-60 hover:opacity-100 hover:bg-gray-800'
        }
        ${isReady ? 'cursor-pointer' : 'cursor-default'}
      `}
    >
        {/* Status Icon Column */}
        <div className="flex-shrink-0">
            {item.status === ParagraphDataStatus.FAILED ? (
                <button
                    onClick={(e) => { e.stopPropagation(); onRetryItem(item.id); }}
                    className="text-red-500 hover:text-red-400"
                    title="Retry Fetch"
                >
                    <RetryIcon className="w-4 h-4" />
                </button>
            ) : item.status === ParagraphDataStatus.FETCHING ? (
                <div className="w-4 h-4 relative flex items-center justify-center">
                    <SpinnerIcon className="w-4 h-4 text-blue-500 animate-spin" />
                </div>
            ) : (
                <StatusIcon status={isWaiting ? 'fetching' : (isCenter && isPlaying ? 'playing' : item.status)} />
            )}
        </div>
        
        {/* Text Content */}
        <div className="min-w-0 flex-1">
            <p className={`
                text-sm leading-snug 
                ${isExpanded ? 'whitespace-normal' : 'truncate'}
                ${isCenter ? 'text-white font-medium' : 'text-gray-300 font-normal'}
            `}>
                {item.displayText}
            </p>
        </div>
    </div>
  );
};


/**
 * The unified playback view.
 */
export const PlaybackSection: React.FC<PlaybackSectionProps> = ({
  text, audioQueue, currentParagraphId, waitingForParagraphId, isPlaying,
  direction, computedDirection,
  onPlayItem, onRetryItem
}) => {
  
  const [showQueueModal, setShowQueueModal] = useState(false);

  // Calculate the 2 relevant paragraphs for the Mini Queue (Current and Next)
  const activeId = waitingForParagraphId ?? currentParagraphId ?? 0;
  
  const miniQueueItems = (() => {
      const currItem = audioQueue[activeId];
      const nextItem = activeId < audioQueue.length - 1 ? audioQueue[activeId + 1] : null;
      // Filter out null/undefined.
      return [currItem, nextItem].filter((item): item is AudioQueueItem => !!item);
  })();

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      
      {/* Main Content Area */}
      <div className="flex-grow min-h-0 relative bg-gray-800/50 rounded-lg border border-gray-700/50 overflow-hidden flex flex-col">
          
             {/* Top: Full Markdown Preview */}
             <div className="flex-grow min-h-0 relative">
                <MarkdownPreview 
                   text={text}
                   activeTab={'input'} // Always active
                   direction={direction}
                   computedDirection={computedDirection}
                />
             </div>
             
             {/* Bottom: Mini Queue (Compact 2 Paragraphs) */}
             <div className="flex-shrink-0 border-t border-gray-700 bg-gray-900 shadow-xl flex flex-col z-10">
                {/* Mini Queue Header */}
                <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
                   <span className="text-xs font-mono text-gray-400">
                     Playing: {activeId < audioQueue.length ? `P.${activeId.toString().padStart(2, '0')}` : '-'}
                   </span>
                   <button 
                     onClick={() => setShowQueueModal(true)}
                     className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                   >
                      <span>Full List</span>
                      <ExpandIcon className="w-3 h-3" />
                   </button>
                </div>

                <div className="flex flex-col gap-1 p-2">
                   {miniQueueItems.map((item) => (
                       <MiniQueueItem 
                          key={item.id}
                          item={item}
                          activeId={activeId}
                          waitingForParagraphId={waitingForParagraphId}
                          isPlaying={isPlaying}
                          computedDirection={computedDirection}
                          onPlayItem={onPlayItem}
                          onRetryItem={onRetryItem}
                       />
                   ))}
                   
                   {miniQueueItems.length === 0 && (
                       <div className="text-center text-gray-500 text-xs py-2">Queue is empty</div>
                   )}
                </div>
             </div>

          {/* QUEUE MODAL OVERLAY */}
          {showQueueModal && (
            <div className="absolute inset-0 z-50 bg-gray-900/95 backdrop-blur-sm flex flex-col animate-fade-in">
                <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-800">
                    <h3 className="text-sm font-bold text-gray-200">Full Queue List</h3>
                    <button 
                        onClick={() => setShowQueueModal(false)}
                        className="p-1 text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-grow min-h-0 overflow-hidden">
                    <StatusList 
                        audioQueue={audioQueue}
                        currentParagraphId={currentParagraphId}
                        waitingForParagraphId={waitingForParagraphId}
                        activeTab='status' // Force active for logic inside component
                        isPlaying={isPlaying}
                        computedDirection={computedDirection}
                        onPlayItem={(id) => {
                            onPlayItem(id);
                        }}
                        onRetryItem={onRetryItem}
                    />
                </div>
            </div>
          )}
      </div>
    </div>
  );
};
