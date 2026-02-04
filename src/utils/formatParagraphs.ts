/**
 * Utility to add proper paragraph formatting to plain text content
 * Automatically detects if content already has HTML and skips formatting
 */

/**
 * Split text into sentences
 */
function splitIntoSentences(text: string): string[] {
  const sentences = text
    .replace(/([.!?])\s+/g, '$1|SPLIT|')
    .split('|SPLIT|')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  return sentences;
}

/**
 * Intelligently group sentences into paragraphs
 * Logic:
 * 1. First 1-2 sentences: Track record and credentials (intro paragraph)
 * 2. Next 3-5 sentences: Experience, specialties, approach (main paragraph)
 * 3. Remaining sentences: Community involvement, awards, charity (final paragraph)
 */
export function formatWithParagraphs(text: string | null | undefined): string | null {
  if (!text) return null;

  // If already has <p> tags, return as-is
  if (text.includes('<p>')) {
    return text;
  }

  // Remove any existing HTML tags except <br>
  const cleanText = text.replace(/<(?!br\s*\/?)[^>]+>/g, '');

  const sentences = splitIntoSentences(cleanText);
  
  if (sentences.length === 0) {
    return text;
  }

  // If only 1-2 sentences, just wrap in single paragraph
  if (sentences.length <= 2) {
    return `<p>${sentences.join(' ')}</p>`;
  }

  const paragraphs: string[] = [];
  let currentParagraph: string[] = [];
  
  // Keywords to identify different sections
  const introKeywords = ['years', 'experience', 'completing', 'transactions', 'rating', 'reviews', 'since', 'founded', 'established'];
  const expertiseKeywords = ['specialize', 'expertise', 'approach', 'methodology', 'team', 'brings', 'coordinates', 'innovative', 'client', 'focus'];
  const communityKeywords = ['serve', 'member', 'committee', 'nonprofit', 'charity', 'volunteer', 'community', 'organize', 'food drive', 'founded', 'board'];

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const lowerSentence = sentence.toLowerCase();
    
    currentParagraph.push(sentence);

    // Determine if we should break here
    let shouldBreak = false;

    // First paragraph: credentials and track record (1-2 sentences)
    if (i === 0 || i === 1) {
      const hasIntroKeywords = introKeywords.some(kw => lowerSentence.includes(kw));
      const nextHasExpertise = i + 1 < sentences.length && 
        expertiseKeywords.some(kw => sentences[i + 1].toLowerCase().includes(kw));
      
      if (hasIntroKeywords && nextHasExpertise && i >= 0) {
        shouldBreak = true;
      }
    }
    // Middle paragraphs: expertise and approach (look for topic shift to community)
    else if (i > 1 && i < sentences.length - 1) {
      const hasCommunityKeywords = communityKeywords.some(kw => lowerSentence.includes(kw));
      const nextHasCommunity = i + 1 < sentences.length && 
        communityKeywords.some(kw => sentences[i + 1].toLowerCase().includes(kw));
      
      // Break before community involvement section starts
      if (nextHasCommunity && !hasCommunityKeywords) {
        shouldBreak = true;
      }
      // Or if current paragraph is getting too long (5+ sentences)
      else if (currentParagraph.length >= 5) {
        shouldBreak = true;
      }
    }

    if (shouldBreak && currentParagraph.length > 0) {
      paragraphs.push(`<p>${currentParagraph.join(' ')}</p>`);
      currentParagraph = [];
    }
  }

  // Add remaining sentences as final paragraph
  if (currentParagraph.length > 0) {
    paragraphs.push(`<p>${currentParagraph.join(' ')}</p>`);
  }

  return paragraphs.join('\n\n');
}

/**
 * Format multiple text fields at once
 * Useful for bulk operations
 */
export function formatTextFields<T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const formatted = { ...obj };
  
  for (const field of fields) {
    if (typeof formatted[field] === 'string') {
      formatted[field] = formatWithParagraphs(formatted[field] as string) as T[keyof T];
    }
  }
  
  return formatted;
}
