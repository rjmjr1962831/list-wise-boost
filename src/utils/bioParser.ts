/**
 * Extract years of experience from bio text by finding "since YYYY" or similar patterns
 */
export function extractYearsFromBio(bioText: string | null | undefined): number | null {
  if (!bioText) return null;
  
  // Common patterns: "since 2004", "Since 2004", "been in the business since 2004", etc.
  const patterns = [
    /since\s+(\d{4})/i,
    /starting\s+in\s+(\d{4})/i,
    /began\s+in\s+(\d{4})/i,
    /started\s+in\s+(\d{4})/i,
  ];
  
  for (const pattern of patterns) {
    const match = bioText.match(pattern);
    if (match && match[1]) {
      const year = parseInt(match[1], 10);
      const currentYear = new Date().getFullYear();
      
      // Sanity check: year should be reasonable (not in the future, not before 1950)
      if (year >= 1950 && year <= currentYear) {
        return currentYear - year;
      }
    }
  }
  
  return null;
}
