# Arizona Neighborhood Writeup Generation Pipeline

## Summary

Generate **~1,910 Arizona neighborhood writeups** using the existing infrastructure. Census data is already populated; this pipeline focuses solely on creating HTML narratives.

**IMPORTANT:** Before starting, re-query the database to get fresh counts. Census data was just populated externally, so the 'missing' counts in this plan may be outdated. The writeup_html count (~1,910 missing) should still be accurate.

**Estimated Cost:** ~$29 (Claude Sonnet)  
**Estimated Runtime:** ~1.5 hours  
**Batch Size:** 25 neighborhoods per invocation

---

## Architecture

Self-triggering edge function following the proven `populate-ca-neighborhoods` pattern:

```
1. Fetch 25 neighborhoods via enrichment-api (query action)
                     ↓
2. For each: Gemini Flash 2.0 → Research (0.5s delay)
                     ↓
3. For each: Claude Sonnet → 300-400 word HTML (1s delay)
                     ↓
4. Update via enrichment-api (update-neighborhood action)
                     ↓
5. Self-trigger next batch (if more remain)
```

---

## Implementation

**File:** `supabase/functions/az-neighborhood-writeups/index.ts`

**Actions:**
- `start` - Begin processing (re-queries for fresh count)
- `continue` - Resume (self-triggered after each batch)
- `status` - Return current progress
- `stop` - Halt processing gracefully

---

## Writeup Format

```html
<h3>Neighborhood Overview</h3>
<p>Desert Ridge stands as one of North Phoenix's...</p>

<h3>Housing & Market</h3>
<p>The real estate market in Desert Ridge reflects...</p>

<h3>Lifestyle & Amenities</h3>
<p>Residents enjoy access to excellent schools...</p>
```

---

## Secrets (All Configured)

- `GEMINI_API_KEY` ✓
- `ANTHROPIC_API_KEY` ✓  
- `ENRICHMENT_API_KEY` ✓

---

## Status: APPROVED - IMPLEMENTING
