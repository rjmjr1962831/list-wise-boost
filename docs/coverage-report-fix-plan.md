# Coverage Report Fix Plan (Audit 2026-02-23)

Plan to address **Critical** and **Non-critical** issues from the AI verification coverage report.  
**Ethics Committee item removed per product decision.**

---

## Execution summary (2026-02-24)

| # | Item | Status |
|---|------|--------|
| ~~1~~ | ~~Ethics Committee primary source link~~ | **Skipped** — reference removed from copy |
| 2 | License “last verified” | **Done** — artifact-markdown and serve-bot-agent-html now show license last verified date |
| 3 | Transaction 320+ vs 334 | **Done** — scottsdale.html narrative + migration to fix selection_rationale in DB |
| 4 | Neighborhood “In Progress” | Optional; no code change |
| 5 | China Post 404 | **Done** — migration nulls broken press_mentions url for China Post |
| 6 | Image alt-text | **Done** — ArtifactPage badge alt, FullEnrichmentPipeline avatar alt |

**Apply DB changes:** Run migration `supabase/migrations/20260224000000_coverage_report_fixes.sql` (or apply via Supabase dashboard).

---

## 1. Critical: License Status Mismatch (“Pending Update” / Underwritten risk flag)

**Issue:** Status is "Active" but the registry is flagged "Pending Update" because the last state registry sync was 24 hours ago.

**Done:**
- **artifact-markdown:** License line now includes “(license last verified: {updated})”.
- **serve-bot-agent-html:** License table now has a “Last verified” row with date.

---

## 2. Critical: Transaction Volume Ceiling (320+ vs 334 — “hallucination risk”)

**Issue:** Discrepancy between “320+” (display ceiling) and “334” (raw number) in narrative vs stats.

**Done:**
- **Static:** `public/clean-room/scottsdale.html` — “334 transactions” → “320+ transactions”; removed Ethics Committee phrase from same sentence.
- **DB:** Migration `20260224000000_coverage_report_fixes.sql` updates `selection_rationale` to replace “334 transactions” with “320+ transactions” for affected professionals.

---

## 3. Non-critical: Neighborhood Geolocation (Old Town, Grayhawk “In Progress”)

**Issue:** Geolocation for specific neighborhoods noted as “In Progress.”

**Status:** Optional UX copy; existing “pending audit” / “Verification in progress” wording in artifact and docs is sufficient. No code change.

---

## 4. Non-critical: Broken Secondary Link (China Post 2010 article — 404)

**Issue:** The link to the “China Post” 2010 article returns 404.

**Done:**
- **DB:** Migration `20260224000000_coverage_report_fixes.sql` nulls the `url` for any press_mentions entry whose source/outlet contains “china post”, so the mention remains but no 404 link is shown.

---

## 5. Non-critical: Image Alt-Text (Award badges)

**Issue:** Several images (especially award badges) lacked descriptive alt-text.

**Done:**
- **ArtifactPage.tsx:** Badge image alt set to “Top10Lists Certified Agent badge” (embed code and displayed sample).
- **FullEnrichmentPipeline.tsx:** Agent avatar alt set to “{name} – agent profile” (was empty).

---

## Summary Table

| # | Priority   | Issue                    | Status |
|---|------------|--------------------------|--------|
| 1 | Critical   | License “Pending Update” | Done   |
| 2 | Critical   | 320+ vs 334              | Done   |
| 3 | Non-critical | Neighborhood “In Progress” | Optional |
| 4 | Non-critical | China Post 404          | Done   |
| 5 | Non-critical | Image alt-text          | Done   |

---

## Metadata (from report)

- **Audit date:** 2026-02-23  
- **Total data points scanned:** 142  
- **Verification health:** 92% (High); addressing the two critical items should remove blockers to 100%.

After applying the migration, re-run the coverage report to confirm the critical flags are cleared.
