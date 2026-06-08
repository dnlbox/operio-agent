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
 * Highlights matches of query keywords in a text block using HTML <mark> tags.
 * 
 * @param text The source text.
 * @param query The space-separated keywords query.
 * @returns The highlighted text containing HTML <mark> tags.
 */
export function highlightKeywords(text: string, query: string): string {
  if (!text) return '';
  if (!query) return text.replace(/\n/g, '<br>');

  const terms = query
    .split(/\s+/)
    .map(t => t.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'))
    .filter(t => t.length > 2);

  if (terms.length === 0) {
    return text.replace(/\n/g, '<br>');
  }

  const regex = new RegExp(`(${terms.join('|')})`, 'gi');
  return text
    .replace(/\n/g, '<br>')
    .replace(regex, `<mark class="query-highlight">$1</mark>`);
}
