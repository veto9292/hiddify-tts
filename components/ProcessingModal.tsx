import React from 'react';

interface ProcessingModalProps {
  isOpen: boolean;
  onCancel: () => void;
}

/**
 * A visually enhanced modal dialog that appears during the initial text processing phase.
 * It features a blurred backdrop, smooth animations, and a custom loading indicator
 * to provide a more polished user experience while blocking interaction.
 */
export const ProcessingModal: React.FC<ProcessingModalProps> = ({ isOpen, onCancel }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in"
      aria-modal="true"
      role="dialog"
      onClick={onCancel} // Allow closing by clicking the backdrop
    >
      <div 
        className="bg-gray-800/90 rounded-xl shadow-2xl p-8 w-full max-w-md text-center border border-gray-700/50 animate-scale-in"
        onClick={e => e.stopPropagation()} // Prevent closing when clicking inside the modal content
      >
        {/* New 'dot wave' loading indicator */}
        <div className="flex justify-center items-center space-x-2 mb-6 dot-wave">
          <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
          <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
          <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-100 mb-4">Processing Text...</h2>
        <p className="text-gray-400 mb-8">Please wait while the AI segments the text for playback.</p>
        
        <button
          onClick={onCancel}
          className="px-8 py-2 border border-red-500/50 text-red-400 font-semibold rounded-lg transition-all duration-200 ease-in-out hover:bg-red-500/20 hover:border-red-500/80 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
          aria-label="Cancel text processing"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};