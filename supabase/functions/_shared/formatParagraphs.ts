/**
 * Bio formatting — Top10Lists.us
 *
 * ARCHITECTURE:
 *   DB stores clean HTML only: <p>, <strong>, <br>. Nothing else.
 *   All write paths call sanitizeBioHtml() before saving.
 *   Display contexts (bot renderer, profile page) use the field directly.
 *   Machine contexts (schema.org description, meta tags) call bioToPlainText().
 *
 * EXPORTS:
 *   sanitizeBioHtml(text)  — enforce clean HTML at write time
 *   bioToPlainText(text)   — strip all tags at read time for machine contexts
 *   formatWithParagraphs   — deprecated alias of sanitizeBioHtml, kept for import compat
 */

const ALLOWED_TAGS = /^(p|strong|br)$/i;

/**
 * sanitizeBioHtml
 *
 * Converts any input (plain text, markdown, dirty HTML) into clean HTML
 * containing only <p>, <strong>, and <br> tags. Safe to write to DB.
 *
 * Rules:
 *   - Strip all tags not in the allowed set
 *   - Convert markdown **bold** to <strong>
 *   - Split on \n\n to form <p> blocks
 *   - Never produce empty paragraphs
 */
export function sanitizeBioHtml(text: string | null | undefined): string | null {
  if (!text) return null;

  let s = text;

  // Convert block-level HTML to paragraph breaks before stripping
  s = s.replace(/<\/p>\s*/gi, '\n\n');
  s = s.replace(/<p[^>]*>/gi, '');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/?(h[1-6]|div|section|article|li|ul|ol|blockquote)[^>]*>/gi, '\n\n');

  // Convert <strong>/<b> to markdown bold before stripping, so we can re-emit
  s = s.replace(/<\/?(strong|b)>/gi, '**');

  // Strip all remaining HTML tags
  s = s.replace(/<[^>]+>/g, '');

  // Decode common entities
  s = s.replace(/&amp;/g, '&')
       .replace(/&lt;/g, '<')
       .replace(/&gt;/g, '>')
       .replace(/&nbsp;/g, ' ')
       .replace(/&mdash;/g, '\u2014')
       .replace(/&ndash;/g, '\u2013')
       .replace(/&#8212;/g, '\u2014')
       .replace(/&#8211;/g, '\u2013');

  // Convert markdown bold to <strong>
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');

  // Normalise whitespace and line breaks
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  s = s.trim();

  // Split on double newlines and wrap each block in <p>
  const paragraphs = s
    .split('\n\n')
    .map(p => p.replace(/\n/g, ' ').trim())
    .filter(p => p.length > 0)
    .map(p => `<p>${p}</p>`);

  if (paragraphs.length === 0) return null;

  return paragraphs.join('\n');
}

/**
 * bioToPlainText
 *
 * Strips all HTML tags for use in machine-readable contexts:
 * schema.org description, JSON-LD fields, meta description tags,
 * artifact description lines. Never use in display HTML.
 */
export function bioToPlainText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/<\/p>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * formatWithParagraphs — deprecated.
 * Kept so existing imports don't break during transition.
 * Callers should migrate to sanitizeBioHtml().
 */
export function formatWithParagraphs(text: string | null | undefined): string | null {
  return sanitizeBioHtml(text);
}
