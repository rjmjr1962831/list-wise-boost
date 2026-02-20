/**
 * AI Citation Probability Index: 2025 vs 2026.
 * Single source of truth for all surfaces (Why AI Trusts Us, funnel Step1Intro, etc.).
 * Source         | 2025 | 2026 | Change
 * Zillow         | 7.7  | 4.4  | -3.3
 * RealTrends     | 6.7  | 5.2  | -1.5
 * Top10Lists.us  | 4.1  | 9.3  | +5.2
 */
export const CITATION_INDEX_CANONICAL: Record<
  "zillow" | "realtrends" | "top10",
  { before: number; now: number }
> = {
  zillow: { before: 7.7, now: 4.4 },
  realtrends: { before: 6.7, now: 5.2 },
  top10: { before: 4.1, now: 9.3 },
};

/** For funnel/Step1Intro: array shape with name, before, after, color */
export const CITATION_INDEX_DISPLAY = [
  { name: "Zillow", before: 7.7, after: 4.4, color: "#006AFF" },
  { name: "RealTrends", before: 6.7, after: 5.2, color: "#8B6914" },
  { name: "Top10Lists.us", before: 4.1, after: 9.3, color: "#10B981" },
] as const;
