/**
 * Parses basic markdown syntax (headings, bold texts, list items) and formats
 * lease/manual sections into clickable citation buttons.
 * 
 * @param text The markdown/text content to compile.
 * @returns The formatted HTML string.
 */
export function parseMarkdown(text: string): string {
  if (!text) return '';

  return text
    // Replace headings (### title)
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    // Replace bold text (**bold**)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Replace bullet points (* list item)
    .replace(/^\*\s(.*?)$/gim, '<li>$1</li>')
    // Highlight Section references (e.g. Section 9.1)
    .replace(/Section \d+(\.\d+)?/g, (match) => `<span class="citation-btn" data-ref="${match}">${match}</span>`)
    // Highlight equipment model manual references
    .replace(/Carrier Model-50TJ/g, (match) => `<span class="citation-btn" data-ref="Carrier Manual">${match}</span>`)
    .replace(/Otis Model-NPE/g, (match) => `<span class="citation-btn" data-ref="Otis Manual">${match}</span>`);
}

/**
 * Escapes query terms so they can be safely embedded in a regular expression.
 *
 * @param query The raw search query.
 * @returns Escaped regex-safe terms longer than two characters.
 */
function getSearchTerms(query: string): string[] {
  return query
    .split(/\s+/)
    .map((term) => term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'))
    .filter((term) => term.length > 2);
}

/**
 * Extracts a contextual snippet around the first matching line so retrieval cards
 * show the relevant passage instead of the full document excerpt.
 *
 * @param text The source text content.
 * @param query The active search query.
 * @param contextLineCount The number of lines to keep above and below the first hit.
 * @returns A plain-text snippet with preserved line breaks.
 */
export function buildSearchSnippet(
  text: string,
  query: string,
  contextLineCount = 5
): string {
  if (!text) return '';

  const lines = text.split(/\r?\n/);
  const terms = getSearchTerms(query);
  if (lines.length === 0) return text;

  if (terms.length === 0) {
    return lines.slice(0, contextLineCount * 2 + 1).join('\n');
  }

  const regex = new RegExp(`(${terms.join('|')})`, 'i');
  const firstMatchIndex = lines.findIndex((line) => regex.test(line));
  const matchIndex = firstMatchIndex >= 0 ? firstMatchIndex : 0;
  const startIndex = Math.max(0, matchIndex - contextLineCount);
  const endIndex = Math.min(lines.length - 1, matchIndex + contextLineCount);
  const visibleLines = lines.slice(startIndex, endIndex + 1);
  const prefix = startIndex > 0 ? '...\n' : '';
  const suffix = endIndex < lines.length - 1 ? '\n...' : '';

  return `${prefix}${visibleLines.join('\n')}${suffix}`.trim();
}

/**
 * Highlights matches of query keywords in a text block using HTML <mark> tags.
 * 
 * @param text The source text.
 * @param query The space-separated keywords query.
 * @returns The highlighted text containing HTML <mark> tags.
 */
export function highlightKeywords(text: string, query: string): string {
  if (!text) return '';
  if (!query) return text.replace(/\n/g, '<br>');

  const terms = getSearchTerms(query);

  if (terms.length === 0) {
    return text.replace(/\n/g, '<br>');
  }

  const regex = new RegExp(`(${terms.join('|')})`, 'gi');
  return text
    .replace(/\n/g, '<br>')
    .replace(regex, `<mark class="query-highlight">$1</mark>`);
}
