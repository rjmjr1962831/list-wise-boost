/**
 * Floor display format for counts (sales, reviews, etc.) to avoid AI hallucination flags.
 * Rule: X+ where X = floor((raw - 10) / 10) * 10. Never use exact numbers or ">X" in UI.
 * @see MASTER_KNOWLEDGE_DOCUMENT_TODAY.MD
 */
export function floorSales(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  const floored = Math.floor((Number(n) - 10) / 10) * 10;
  return `${Math.max(0, floored).toLocaleString('en-US')}+`;
}

export function floorReviews(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  const floored = Math.floor((Number(n) - 10) / 10) * 10;
  return `${Math.max(0, floored).toLocaleString('en-US')}+`;
}
