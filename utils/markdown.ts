import { Marked, Renderer } from 'marked';
import type { DirectionMode } from '../types';

// SVG icon for the copy button, to be embedded in the rendered HTML.
const copyIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;

// Create a custom renderer to add a header with language and a copy button to code blocks.
const renderer = new Renderer();

// Configure custom code block rendering
// We handle both token object (Marked v5+) and argument list (older Marked) signatures for robustness.
renderer.code = (tokenOrCode: any, langIfString?: string): string => {
  const code = typeof tokenOrCode === 'object' ? tokenOrCode.text : tokenOrCode;
  const lang = typeof tokenOrCode === 'object' ? tokenOrCode.lang : langIfString;

  const languageDisplay = lang ? lang.charAt(0).toUpperCase() + lang.slice(1) : '';
  // The 'code' argument is already highlighted HTML because we use our walkTokens extension.
  const highlightedCode = code;

  // Construct the header with the language name and copy button.
  const header = `
    <div class="code-block-header">
      <span class="language-name">${languageDisplay}</span>
      <button class="copy-code-button" title="Copy code">
        ${copyIconSvg}
      </button>
    </div>
  `;
  
  const langClass = lang ? `language-${lang}` : '';

  return `
    <div class="code-block-wrapper">
      ${header}
      <pre><code class="${langClass} hljs">${highlightedCode}</code></pre>
    </div>
  `;
};

// Configure Marked with custom renderer and Highlight.js
const marked = new Marked({
  gfm: true,
  breaks: false,
  pedantic: false,
  renderer: renderer,
});

// Use the highlight.js library for syntax highlighting via a walkTokens extension.
marked.use({
  walkTokens: (token) => {
    if (token.type === 'code') {
      // Access hljs via window because it is loaded via CDN in index.html.
      // This avoids "hljs is not defined" ReferenceErrors in module scopes.
      // Added check for window existence for robustness.
      const hljs = typeof window !== 'undefined' ? (window as any).hljs : undefined;
      
      if (!hljs) {
        // If highlight.js hasn't loaded yet, we skip highlighting to prevent crashes.
        return;
      }

      // Check if the language is supported by highlight.js, otherwise default to plaintext.
      // We default to 'plaintext' if lang is undefined or not found.
      const lang = token.lang || 'plaintext';
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      try {
        // Update token text with highlighted HTML
        token.text = hljs.highlight(token.text, { language, ignoreIllegals: true }).value;
      } catch (__) {
        // Fallback in case of an unexpected error
      }
    }
  },
});

/**
 * Converts a Markdown string to an HTML string for display in the UI.
 * @param markdown The raw Markdown string.
 * @param directionMode Kept for API compatibility but not currently used within the function.
 * @returns An HTML string.
 */
export async function markdownToHtml(markdown: string, directionMode: DirectionMode): Promise<string> {
  return await marked.parse(markdown) as string;
}

// Re-export pure text utilities for backward compatibility or cleaner imports if needed
export * from './textProcessing';
