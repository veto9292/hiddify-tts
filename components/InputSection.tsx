import React, { useState, useRef } from 'react';
import { PlayIcon, PasteIcon, CopyIcon, DownloadIcon, TuneIcon, CloseIcon } from './icons';

interface InputSectionProps {
  text: string;
  setText: (text: string) => void;
  computedDirection: 'ltr' | 'rtl';
  systemInstruction: string;
  setSystemInstruction: (text: string) => void;
  maxConcurrentFetches: number;
  setMaxConcurrentFetches: (num: number) => void;
  isProcessingText: boolean;
  onGenerate: () => void;
}

export const InputSection: React.FC<InputSectionProps> = ({
  text, setText, computedDirection,
  systemInstruction, setSystemInstruction, maxConcurrentFetches, setMaxConcurrentFetches,
  isProcessingText, onGenerate
}) => {
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'error' } | null>(null);
  
  const concurrencyLongPressTimerRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const showToast = (message: string, type: 'info' | 'error' = 'info') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ message, type });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handlePaste = async () => {
    // 1. Focus the textarea first. This is often required for the browser to associate the clipboard action with the active element.
    if (textareaRef.current) {
      textareaRef.current.focus();
    }

    try {
        // 2. Direct call to readText. This is the standard way to trigger the permission prompt.
        const clipboardText = await navigator.clipboard.readText();
        
        if (clipboardText) {
            setText(clipboardText);
            showToast("Pasted successfully", 'info');
        } else {
            showToast("Clipboard is empty", 'info');
        }
    } catch (err: any) {
        console.error("Paste error:", err);
        
        // 3. Robust error handling including policy errors
        if (
            err.name === 'NotAllowedError' || 
            err.message?.toLowerCase().includes('denied') ||
            err.message?.toLowerCase().includes('permissions policy')
        ) {
            showToast("Clipboard access blocked. Please use Ctrl+V.", 'error');
        } else {
            showToast("Paste failed. Please use Ctrl+V.", 'error');
        }
    }
  };

  const handleCopy = async () => {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
         try {
            if (textareaRef.current) {
                textareaRef.current.select();
                document.execCommand('copy');
                showToast("Copied to clipboard", 'info');
            }
         } catch (e) {
             showToast("Copy unavailable. Please use Ctrl+C", 'error');
         }
         return;
    }

    try {
        await navigator.clipboard.writeText(text);
        showToast("Copied successfully", 'info');
    } catch (err) {
         showToast("Failed to copy text", 'error');
    }
  };

  const handleCycleConcurrency = () => {
      const nextValue = maxConcurrentFetches >= 10 ? 1 : maxConcurrentFetches + 1;
      setMaxConcurrentFetches(nextValue);
  };
  
  const clearConcurrencyLongPressTimer = () => {
    if (concurrencyLongPressTimerRef.current) {
        clearTimeout(concurrencyLongPressTimerRef.current);
        concurrencyLongPressTimerRef.current = null;
    }
  };

  const handleConcurrencyMouseDown = () => {
      clearConcurrencyLongPressTimer();
      concurrencyLongPressTimerRef.current = window.setTimeout(() => {
          setMaxConcurrentFetches(3); 
          concurrencyLongPressTimerRef.current = null;
      }, 500);
  };

  const handleConcurrencyMouseUp = () => {
      if (concurrencyLongPressTimerRef.current !== null) {
          clearConcurrencyLongPressTimer();
          handleCycleConcurrency();
      }
  };

  return (
    <div className="flex flex-col gap-4 min-h-0 h-full relative group">
        <div className="flex-grow relative min-h-0">
          <textarea
              ref={textareaRef}
              dir={computedDirection}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full h-full bg-gray-800 border border-gray-700 rounded-md p-4 text-base leading-relaxed resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Paste your text or markdown here..."
          />
          
          {toast && (
            <div className={`absolute top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg shadow-2xl text-sm font-semibold z-20 animate-fade-in flex items-center gap-2 pointer-events-none transition-all duration-300 ${
                toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'
            }`}>
                {toast.type === 'error' && <span className="text-lg">⚠️</span>}
                {toast.message}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 flex gap-2 items-center justify-between">
            <div className='flex gap-2 items-center flex-wrap'>
              <button
                onClick={onGenerate}
                disabled={text.trim().length === 0 || isProcessingText}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors duration-200 ease-in-out disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm shadow-md"
              >
                <PlayIcon className="w-5 h-5" /> Generate & Play
              </button>
              <button 
                onClick={handlePaste} 
                className="bg-gray-700 hover:bg-gray-600 p-2 rounded-md transition-colors flex items-center shadow-sm text-gray-300 hover:text-white" 
                title="Paste from clipboard"
              >
                <PasteIcon className="w-5 h-5"/>
              </button>
              <button onClick={handleCopy} className="bg-gray-700 hover:bg-gray-600 p-2 rounded-md transition-colors flex items-center shadow-sm text-gray-300 hover:text-white" title="Copy"><CopyIcon className="w-5 h-5"/></button>
              <button
                onMouseDown={handleConcurrencyMouseDown}
                onMouseUp={handleConcurrencyMouseUp}
                onMouseLeave={clearConcurrencyLongPressTimer}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-md transition-colors flex items-center gap-2 text-sm font-mono shadow-sm text-gray-300 hover:text-white"
                title="Click to cycle concurrency (1-10). Long press to reset to 3."
              >
                  <DownloadIcon className="w-5 h-5"/>
                  <span>{maxConcurrentFetches}</span>
              </button>
              <button
                onClick={() => setShowSettingsModal(true)}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-md transition-colors flex items-center gap-2 text-sm shadow-sm text-gray-300 hover:text-white"
                title="Configure TTS Preprocessor"
              >
                  <TuneIcon className="w-5 h-5" />
                  <span className="hidden sm:inline">TTS Preprocessor</span>
              </button>
            </div>
        </div>

        {showSettingsModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4" onClick={() => setShowSettingsModal(false)}>
                <div 
                    className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl border border-gray-700 flex flex-col max-h-[90vh] animate-scale-in"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between p-4 border-b border-gray-700">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <TuneIcon className="w-5 h-5 text-blue-400" />
                            TTS Preprocessor Settings
                        </h3>
                        <button onClick={() => setShowSettingsModal(false)} className="text-gray-400 hover:text-white transition-colors">
                            <CloseIcon className="w-6 h-6" />
                        </button>
                    </div>
                    
                    <div className="p-6 flex-grow overflow-y-auto">
                        <label htmlFor="system-instruction" className="block text-sm font-medium text-blue-300 mb-2">System Instruction</label>
                        <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                            This instruction guides the AI model on how to preprocess and segment your text before converting it to speech.
                        </p>
                        <textarea
                            id="system-instruction"
                            value={systemInstruction}
                            onChange={(e) => setSystemInstruction(e.target.value)}
                            className="w-full h-64 bg-gray-900 border border-gray-700 rounded-lg p-4 text-sm leading-relaxed resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-200 font-mono"
                        />
                    </div>

                    <div className="p-4 border-t border-gray-700 flex justify-end">
                        <button 
                            onClick={() => setShowSettingsModal(false)}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
                        >
                            Done
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};