import { Marked } from 'marked';

/**
 * Detects the dominant writing direction of a text snippet.
 * It analyzes the first 200 characters, counting strong LTR (Latin) and
 * RTL (Arabic/Persian) characters to make a more reliable determination
 * than just checking the first character.
 * 
 * @param text The text to analyze.
 * @returns 'rtl' if RTL characters are dominant, otherwise 'ltr'.
 */
export function detectDirection(text: string): 'ltr' | 'rtl' {
  // Use a sample of the text for efficiency.
  const sample = text.substring(0, 200);
  
  // Count RTL characters (Arabic script range).
  const rtlChars = sample.match(/[\u0600-\u06FF]/g) || [];
  
  // Count LTR characters (Latin script range).
  const ltrChars = sample.match(/[a-zA-Z]/g) || [];

  // If RTL characters are more numerous, the text is considered RTL.
  // Otherwise, default to LTR. This handles neutral characters and empty strings.
  if (rtlChars.length > ltrChars.length) {
    return 'rtl';
  }
  
  return 'ltr';
}

/**
 * Performs final sanitization on a plain text string before sending it to the TTS API.
 * This includes converting Persian/Arabic numerals, handling leftover Markdown table pipe
 * characters, and removing other symbols that can cause TTS errors or awkward phrasing.
 * 
 * @param text The plain text string (after Markdown has been stripped).
 * @returns A sanitized string ready for the API.
 */
export function sanitizeForTTS(text: string): string {
  const persianNumerals = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const westernNumerals = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

  let newText = text;
  
  // 1. Convert Persian numerals to Western numerals for broader compatibility.
  for (let i = 0; i < 10; i++) {
    newText = newText.replace(new RegExp(persianNumerals[i], 'g'), westernNumerals[i]);
  }
  
  // 2. Handle leftover markdown table rows that were not fully processed.
  // This can happen if a single row is treated as a "paragraph".
  const trimmedText = newText.trim();
  if (trimmedText.startsWith('|') && trimmedText.endsWith('|')) {
    const parts = trimmedText.split('|').slice(1, -1).map(s => s.trim());
    
    // Check for separator rows like |---|---|, which are unspeakable.
    const isSeparatorRow = parts.every(part => /^-+$/.test(part));
    if (isSeparatorRow) {
      // Return an empty string so the fetch logic can skip the API call.
      newText = '';
    } else {
      // Linearize the data row into a readable sentence.
      newText = parts.filter(s => s.length > 0).join(', ');
    }
  }

  // 3. Aggressive Whitelist Sanitization: Remove any character that is NOT a letter,
  // number, whitespace, comma, period, hyphen, or standard punctuation.
  // Included [!?:;] to allow for better speech prosody and pausing.
  newText = newText.replace(/[^a-zA-Z0-9\u0600-\u06FF\s,.\-!?:;]/gu, '');


  // 4. Final Cleanup: Collapse multiple whitespace characters and trim. This ensures
  // there are no unpronounceable gaps or weird whitespace artifacts from the parsing steps.
  return newText.replace(/\s+/g, ' ').trim();
}

/**
 * Strips all Markdown syntax from a string to return clean, plain text suitable for a TTS engine.
 * It includes special handling to linearize tables into a readable, sentence-like format
 * and correctly handles spacing between block-level elements.
 * 
 * @param markdown The raw Markdown string.
 * @returns A plain text string.
 */
export async function stripMarkdown(markdown: string): Promise<string> {
  // Use a local instance of Marked for stripping to avoid conflicting with the main renderer
  const simpleMarked = new Marked();
  const html = await simpleMarked.parse(markdown) as string;
  
  // Use the browser's DOM parser to create a document object from the HTML.
  const doc = new DOMParser().parseFromString(html, 'text/html');
  
  // Find all tables and replace them with a linearized text version.
  doc.querySelectorAll('table').forEach(table => {
    let linearizedTable = '';
    const rows = Array.from(table.querySelectorAll('tr'));
    
    rows.forEach((row) => {
      const cells = Array.from(row.querySelectorAll('th, td'));
      // A heuristic to detect and skip markdown table separator rows (e.g., |---|---|).
      const isSeparatorRow = cells.every(cell => /^-+$/.test(cell.textContent?.trim() || ''));
      if (isSeparatorRow) return;

      const cellTexts = cells.map(cell => cell.textContent?.trim() || '');
      // Join cells to form a sentence, which is more natural for a TTS engine.
      linearizedTable += cellTexts.join(', ') + '. ';
    });

    // Replace the entire <table> element with a single text node containing the linearized content.
    if (table.parentNode) {
      table.parentNode.replaceChild(document.createTextNode(linearizedTable), table);
    }
  });
  
  // To prevent text from adjacent block elements from merging (e.g., "item1item2"),
  // we add a space after each block element.
  doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, hr, pre').forEach(el => {
    el.appendChild(document.createTextNode(' '));
  });

  // Return the full text content, collapsing all whitespace sequences into a single space.
  return (doc.body.textContent || "").replace(/\s+/g, ' ').trim();
}