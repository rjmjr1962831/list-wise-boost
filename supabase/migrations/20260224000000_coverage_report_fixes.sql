-- Coverage report fixes (2026-02-23): transaction narrative consistency, broken press link
-- Run on staging/production to align with coverage-report-fix-plan.

-- 1. Transaction volume: use display format "320+" in selection_rationale to match stats (avoid AI hallucination flag)
UPDATE professionals
SET selection_rationale = REPLACE(selection_rationale, '334 transactions', '320+ transactions')
WHERE selection_rationale IS NOT NULL AND selection_rationale LIKE '%334 transactions%';

-- 2. China Post 404: null out broken press_mentions url for China Post entry (mention stays, no 404 link)
UPDATE professionals
SET press_mentions = (
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN (elem->>'source' ILIKE '%china post%' OR elem->>'outlet' ILIKE '%china post%')
        THEN elem - 'url' || '{"url": null}'::jsonb
        ELSE elem
      END
    ), '[]'::jsonb
  )
  FROM jsonb_array_elements(COALESCE(press_mentions, '[]'::jsonb)) AS elem
)
WHERE press_mentions IS NOT NULL
  AND press_mentions::text ILIKE '%china%'
  AND press_mentions::text ILIKE '%post%';
