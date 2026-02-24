/**
 * normBioText
 * Replaces raw transaction and review counts in bio text (HTML or plain)
 * with the floor display format per the master doc rule:
 *   X+ where X = floor((raw - 10) / 10) * 10
 *
 * Applies only to transaction and review counts. Never touches years,
 * prices, square footage, or other numeric fields.
 *
 * Safe to call on HTML strings -- operates on the string level without
 * parsing; the patterns are specific enough to avoid false matches.
 */
export function normBioText(text: string | null | undefined): string {
  if (!text) return text ?? '';

  const floor = (n: number): number =>
    Math.max(0, Math.floor((n - 10) / 10) * 10);

  return text
    // Transaction counts: "334 transactions", "334 career transactions", etc.
    .replace(
      /\b(\d{2,6})\s+(career\s+|total\s+|verified\s+)?(transactions?)\b/gi,
      (_match, num, qualifier, word) =>
        `${floor(parseInt(num, 10))}+ ${qualifier ?? ''}${word}`
    )
    // Review counts: "80 reviews", "80 verified reviews", "1,090 reviews"
    .replace(
      /\b([\d,]{2,9})\s+(verified\s+|client\s+)?(reviews?)\b/gi,
      (_match, num, qualifier, word) =>
        `${floor(parseInt(num.replace(/,/g, ''), 10))}+ ${qualifier ?? ''}${word}`
    );
}
