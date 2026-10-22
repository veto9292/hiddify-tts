import React, { useMemo } from 'react';
import { useAudioApp } from './hooks/useAudioApp';
import { InputSection } from './components/InputSection';
import { PlaybackSection } from './components/PlaybackSection';
import { ControlPanel } from './components/ControlPanel';
import { ParagraphDataStatus, DirectionMode } from './types';
import { ProcessingModal } from './components/ProcessingModal';
import { TerminalIcon } from './components/icons';

const App: React.FC = () => {
  // Use the custom hook to manage all application state and logic
  const {
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
    handlePlayPause,
    handleAudioPlay,
    handleAudioPause,
    playAudio,
    handleAudioEnded,
    handleRetry,
    handleDownload,
    handleCancelProcessing,
  } = useAudioApp();

  // Computed property passed to child components
  const isPlaying = appState === 'playback' && !isPaused && currentParagraphId !== null;
  
  const isDownloadReady = useMemo(() => 
    audioQueue.length > 0 && audioQueue.every(item => item.status === ParagraphDataStatus.READY || item.status === ParagraphDataStatus.FAILED),
    [audioQueue]
  );

  // Logic for Previous Button
  const handlePrevious = () => {
    if (currentParagraphId !== null && currentParagraphId > 0) {
        playAudio(currentParagraphId - 1);
    }
  };
  
  const isPreviousReady = useMemo(() => {
    if (currentParagraphId === null || currentParagraphId <= 0) return false;
    // Check if the previous paragraph exists and is ready
    const prevItem = audioQueue[currentParagraphId - 1];
    return prevItem && prevItem.status === ParagraphDataStatus.READY;
  }, [currentParagraphId, audioQueue]);


  // Helper to render the Logs View
  const renderLogs = () => (
    <div className="w-full h-full bg-gray-800/50 rounded-lg p-4 overflow-y-auto border border-gray-700/50 backdrop-blur-sm">
        <pre className="text-xs text-gray-400 whitespace-pre-wrap font-mono">
            {logs.length > 0 ? logs.join('\n') : "No logs available."}
        </pre>
    </div>
  );

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-900 text-white font-sans overflow-hidden">
      <ProcessingModal isOpen={isProcessingText} onCancel={handleCancelProcessing} />
      
      {/* HEADER */}
      <header className="flex-shrink-0 bg-gray-900/95 backdrop-blur border-b border-gray-800 p-3 flex justify-between items-center z-20 relative h-14">
        <h1 className="text-lg font-bold text-blue-400 tracking-tight">Hiddify TTS</h1>
        
        <div className="flex items-center gap-3">
            <audio 
                ref={audioPlayerRef} 
                onEnded={handleAudioEnded}
                onPlay={handleAudioPlay}
                onPause={handleAudioPause}
                className="hidden" 
            />
            
            {/* Global Direction Controls */}
            <div className="flex bg-gray-800 rounded-md p-0.5 border border-gray-700/50">
                {(['auto', 'ltr', 'rtl'] as DirectionMode[]).map(dir => (
                    <button 
                        key={dir} 
                        onClick={() => setDirection(dir)} 
                        className={`
                            px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-sm transition-all duration-200
                            ${direction === dir 
                                ? 'bg-blue-600 text-white shadow-sm' 
                                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'}
                        `}
                    >
                        {dir}
                    </button>
                ))}
            </div>

            {/* Logs Toggle Button - Always Visible */}
            <button
                onClick={() => setShowLogs(!showLogs)}
                className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border border-transparent
                    ${showLogs 
                        ? 'bg-blue-900/30 text-blue-300 border-blue-800' 
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border-gray-700/50'}
                `}
                title="Toggle Logs"
            >
                <TerminalIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Logs</span>
            </button>
        </div>
      </header>
      
      {/* MAIN CONTENT */}
      <main className="flex-grow flex flex-col min-h-0 relative overflow-hidden">
        {showLogs ? (
             <div className="h-full p-4">
                 {renderLogs()}
             </div>
        ) : appState === 'input' ? (
            <div className="h-full p-4">
                <InputSection 
                    text={text}
                    setText={setText}
                    computedDirection={computedDirection}
                    systemInstruction={systemInstruction}
                    setSystemInstruction={setSystemInstruction}
                    maxConcurrentFetches={maxConcurrentFetches}
                    setMaxConcurrentFetches={setMaxConcurrentFetches}
                    isProcessingText={isProcessingText}
                    onGenerate={handleGenerateAndPlay}
                />
            </div>
        ) : (
            <div className="h-full flex flex-col">
                {/* Content Area */}
                <div className="flex-grow min-h-0 p-4 pb-2">
                    <PlaybackSection 
                        text={text}
                        audioQueue={audioQueue}
                        currentParagraphId={currentParagraphId}
                        waitingForParagraphId={waitingForParagraphId}
                        isPlaying={isPlaying}
                        direction={direction}
                        computedDirection={computedDirection}
                        onPlayItem={playAudio}
                        onRetryItem={handleRetry}
                    />
                </div>

                {/* Footer: Control Panel */}
                <div className="flex-shrink-0 px-4 pb-4 pt-2">
                     <ControlPanel 
                        currentParagraphId={currentParagraphId}
                        waitingForParagraphId={waitingForParagraphId}
                        isPaused={isPaused}
                        onPlayPause={handlePlayPause}
                        onPrevious={handlePrevious}
                        isPreviousReady={isPreviousReady}
                        onStop={handleStop}
                        playbackSpeed={playbackSpeed}
                        setPlaybackSpeed={setPlaybackSpeed}
                        isDownloading={isDownloading}
                        isDownloadReady={isDownloadReady}
                        onDownload={handleDownload}
                    />
                </div>
            </div>
        )}
      </main>
    </div>
  );
};

export default App;