/**
 * Extract years of experience from bio text by finding "since YYYY", "X years", etc.
 */
export function extractYearsFromBio(bioText: string | null | undefined): number | null {
  if (!bioText) return null;
  
  const foundYears: number[] = [];
  
  // Pattern 1: Direct year mentions like "15 years of experience", "over 20 years"
  const directYearPatterns = [
    /(\d+)\+?\s+years?\s+(?:of\s+)?(?:experience|in\s+(?:the\s+)?(?:business|industry|real\s+estate))/i,
    /(?:over|more\s+than|nearly)\s+(\d+)\s+years?/i,
  ];
  
  for (const pattern of directYearPatterns) {
    const match = bioText.match(pattern);
    if (match && match[1]) {
      const years = parseInt(match[1], 10);
      if (years > 0 && years <= 70) { // Sanity check
        foundYears.push(years);
      }
    }
  }
  
  // Pattern 2: "Since YYYY" mentions
  const sinceYearPatterns = [
    /since\s+(\d{4})/i,
    /starting\s+in\s+(\d{4})/i,
    /began\s+in\s+(\d{4})/i,
    /started\s+in\s+(\d{4})/i,
  ];
  
  const currentYear = new Date().getFullYear();
  for (const pattern of sinceYearPatterns) {
    const match = bioText.match(pattern);
    if (match && match[1]) {
      const year = parseInt(match[1], 10);
      // Sanity check: year should be reasonable (not in the future, not before 1950)
      if (year >= 1950 && year <= currentYear) {
        foundYears.push(currentYear - year);
      }
    }
  }
  
  // Return the highest value found (most conservative estimate)
  return foundYears.length > 0 ? Math.max(...foundYears) : null;
}
