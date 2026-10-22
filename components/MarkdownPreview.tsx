import React, { useEffect, useState } from 'react';
import { markdownToHtml } from '../utils/markdown';
import { DirectionMode } from '../types';

interface MarkdownPreviewProps {
  text: string;
  activeTab: string;
  direction: DirectionMode;
  computedDirection: 'ltr' | 'rtl';
}

/**
 * Renders the "Input" tab content.
 * It converts the raw Markdown text into HTML and displays it with proper styling.
 */
export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  text,
  activeTab,
  direction,
  computedDirection
}) => {
  const [renderedHtml, setRenderedHtml] = useState<string>('');

  // Convert Markdown to HTML only when the Input tab is active to save resources.
  useEffect(() => {
    if (activeTab === 'input') {
      let isCancelled = false;
      
      const processMarkdown = async () => {
        const html = await markdownToHtml(text, direction);
        if (!isCancelled) {
          setRenderedHtml(html);
        }
      };

      processMarkdown();

      return () => {
        isCancelled = true;
      };
    }
  }, [activeTab, text, direction]);

  // Setup Copy Code Buttons functionality
  // This adds event listeners to the rendered HTML buttons since they are injected via innerHTML.
  useEffect(() => {
    const checkIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;

    const handleClick = async (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const copyButton = target.closest<HTMLElement>('.copy-code-button');

      if (copyButton) {
        const wrapper = copyButton.closest('.code-block-wrapper');
        const codeEl = wrapper?.querySelector('pre > code');
        
        if (codeEl?.textContent) {
          try {
            await navigator.clipboard.writeText(codeEl.textContent);
            const originalContent = copyButton.innerHTML;
            copyButton.innerHTML = checkIconSvg;
            copyButton.setAttribute('disabled', 'true');
            
            setTimeout(() => {
              copyButton.innerHTML = originalContent;
              copyButton.removeAttribute('disabled');
            }, 2000);
          } catch (err) {
            console.error('Failed to copy text: ', err);
          }
        }
      }
    };

    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, []);

  if (activeTab !== 'input') return null;

  return (
    <div className="w-full h-full bg-gray-800 p-4 overflow-y-auto">
      <div 
        dir={computedDirection} 
        className="prose prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    </div>
  );
};