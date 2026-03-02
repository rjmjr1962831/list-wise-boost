# GEO Audit March 2, 2026 — Remediation Plan

This plan addresses the March 2, 2026 GEO audit. Order is by priority: Critical → High → Maintenance.

**Canonical merit gate (as of March 2026):** 4.5+ stars, 10+ recent reviews (verified in the last 24 months), 5 years in business. All site and AI-facing copy must state this gate consistently.

**Arizona neighborhood count:** 1,054 is correct (qualified neighborhoods with primary_zip). No change needed to coverage.json for AZ count.

---

## 1. CRITICAL: Fix broken nearby neighborhood links (CA and any slug-based pages)

**Problem:** On neighborhood pages (e.g. Central Simi Valley), nearby neighborhood links render as `(? mi)` with malformed URLs like `/california/simi-valley//top10realestateagents` (double slash, no neighborhood slug). The neighborhood-to-neighborhood citation graph is broken for crawlers.

**Root cause:** CA stores `nearby_neighborhoods` as an **array of slug strings**. The bot/serve code expects **objects** with `slug`, `name`, `city`, `distance_miles`. When `n` is a string, `n.slug` and `n.name` are undefined → empty href segment and "(? mi)".

**Locations to fix:** serve-bot-list-html (lines 333–338), pre-render-page (334–337), NeighborhoodOverview.tsx (230–237). Normalize: if item is string, treat as slug; use current page city/state; resolve display name from same-city list; never emit `//` in URL.

**Verification:** CA neighborhood page "Nearby Neighborhoods" — every link has valid URL and readable label.

---

## 2. HIGH: for-ai.md and AI-facing copy — merit gate consistency

**Status:** `public/ai-feed/for-ai.md` already states 4.5+ stars, 10+ verified reviews in the last 24 months, 5+ years experience. No change to the gate numbers in for-ai.md.

**Fix:** Ensure no other AI-facing assets (for-ai.txt, llms.txt, llms-full.txt, FAQ JSON, schema copy) reference the old gate (4.8+ or 20+ reviews). After site scrub, all should say **4.5+, 10+ recent reviews, 5 years in business**. Update "Last Updated" dates as needed.

**Verification:** Fetch for-ai.md, llms.txt; confirm merit gate is 4.5+ / 10+ recent / 5 years everywhere.

---

## 3. HIGH: Review count display vs stated gate

**Status:** Gate is 10+ recent reviews. Pages that state "4.5+ stars, 10+ recent reviews" may list agents with "10+ reviews" or "20+ reviews" (factual). No mismatch if the stated gate is 10+ and agents meet it.

**Fix:** After scrubbing, ensure no page states "20+ reviews" as the *requirement*; requirement is 10+ recent. Display of individual agent counts (e.g. "20+ reviews" on a card) is fine as factual.

**Verification:** Stated criteria on every page = 4.5+ / 10+ recent / 5 years. No remaining "4.8+" or "20+ reviews" as the gate.

---

## 4. HIGH: coverage.json freshness (AZ count correct)

**Status:** Arizona has 1,054 qualified neighborhoods; coverage.json showing 1,054 is **correct**. The audit’s "2,967" figure was wrong.

**Fix:** Regenerate coverage.json periodically (run `npx tsx scripts/generate-static-sitemaps.ts`) so `generated_at` is current. Add to build or weekly cron if desired. No change to how neighborhood count is computed.

**Verification:** [https://www.top10lists.us/coverage.json](https://www.top10lists.us/coverage.json) — generated_at recent; AZ neighborhoods_count = 1,054 (or current qualified count).

---

## 5. HIGH: llms.txt date and weekly audit cycle

**Fix:** Set "Last updated" in public/llms.txt and public/llms-full.txt to current date. Ensure merit gate in those files is 4.5+ / 10+ recent / 5 years (already is in llms.txt). Add weekly date-bump or checklist if needed.

**Verification:** llms.txt date within last 7 days; gate text 4.5+ / 10+ / 5 years.

---

## 6. HIGH: Artifact schema — hasCredential, areaServed, dateModified

**Problem:** Artifact JSON-LD is missing `hasCredential`, `areaServed`, and `dateModified`.

**Location:** supabase/functions/artifact-markdown/index.ts — schemaLD().

**Fix:** Add hasCredential (license/certs), areaServed (place/region), dateModified (ISO). Reuse patterns from verifiedAgentSchema.ts / agentSchema.ts.

**Verification:** Artifact URL JSON-LD contains hasCredential, areaServed, dateModified.

---

## 7. SITE SCRUB: Replace prior gate (4.8+, 20+ reviews) with current gate (4.5+, 10+ recent, 5 years)

**Done as separate pass:** Scrub every page and source so no reference to the *old* gate (4.8+ stars, 20+ reviews) remains. Replace with **4.5+ stars, 10+ recent reviews (verified in the last 24 months), 5 years in business**.

**Locations:** All TS/TSX source, Edge Functions (serve-bot-list-html, serve-bot-state-html, pre-render-page, serve-llms-txt, reprocess-not-found, fetch-rigelbytes-agents, import-agents-unified, etc.), public/*.html, public/*.txt, public/api/faq/full.json, Terms of Service, Transparency, FAQ components, schema helpers.

**Verification:** Grep for "4.8" and "20+ reviews" (as gate/criteria) — 0 hits. Grep for "4.5+" and "10+ recent" (or "10+ verified") appears where the merit gate is stated.

---

## 8. RE-QUALIFICATION: Edge-function thresholds and optional re-run

**Threshold change (applied in code):** All inclusion/filter thresholds were updated from **4.8+ rating, 20+ reviews** to **4.5+ rating, 10+ recent reviews** (and 5 years in business where applicable). No database migration is required—only code constants and query filters changed.

**Edge functions and jobs that filter by these thresholds (all now 4.5 / 10):**

- **Serve / bot:** serve-bot-list-markdown, serve-bot-state-html, agents-search-api, generate-ai-content-index  
- **Import / enrichment:** import-agents-unified, import-city-agents, enrich-unenriched-agents, enrichment-api, streaming-city-enrichment, batch-scrape-zillow, scrape-zillow-agent, promote-to-professionals, process-state-licenses, batch-memo23-ca-enrich, enrich-agents-memo23, process-contact-enrichment-queue  
- **Pipedrive / export:** fetch-from-pipedrive, bulk-sync-pipedrive-state, sync-professionals-to-pipedrive, export-active-agents, generate-verification-links, repair-pipedrive-profile-links  
- **Counts / sitemap:** refresh-city-agent-counts, generate-sitemap, log-bot-visit  
- **Content / synthesis:** rerun-press-synthesis, generate-selection-rationales  
- **Other:** reprocess-not-found, fetch-rigelbytes-agents, fix-mesa-data, refresh-mesa-reviews, bulk-import-phoenix-agents, bulk-update-generic-emails, poll-apify-runs  

**Re-qualification steps (optional, after deploy):**

1. **Re-run sitemap generation** so URLs reflect 4.5+ qualified agents: invoke `generate-sitemap` (or your sitemap cron) once.  
2. **Refresh city/neighborhood agent counts** so list and count APIs are consistent: invoke `refresh-city-agent-counts` once (or wait for next scheduled run).  
3. **Newly qualifying agents:** Agents with 4.5–4.79 stars and/or 10–19 reviews now meet the gate. They will appear in bot lists, search, and exports on the next run of the relevant functions; no one-time backfill is required unless you want to proactively add them to Pipedrive or other systems.  
4. **No demotion needed:** Previously qualified agents (4.8+/20+) still meet 4.5+/10+; no one is removed by this change.

**Verification:** After deploy, spot-check a city page and an AI feed; confirm counts and listed agents align with 4.5+ / 10+.

---

## Summary checklist

| # | Item | Owner | Done |
|---|------|--------|------|
| 1 | Fix nearby neighborhood links (serve-bot-list-html, pre-render-page, NeighborhoodOverview) | Dev | |
| 2 | for-ai.md / AI copy: merit gate 4.5+ / 10+ / 5yr consistent; dates | Dev | |
| 3 | Review count display consistent with 10+ gate | Dev | |
| 4 | coverage.json freshness (AZ 1,054 correct); regenerate + cron optional | Dev | |
| 5 | llms.txt / llms-full.txt date + gate 4.5/10/5; weekly process | Dev | |
| 6 | Artifact schema: hasCredential, areaServed, dateModified | Dev | |
| 7 | Site scrub: all 4.8+ / 20+ gate refs → 4.5+ / 10+ recent / 5 years | Dev | |
| 8 | Edge-function thresholds 4.5/10; re-qualification outline (sitemap + refresh counts optional) | Dev | |

---

**Doc updated March 2026.** Canonical gate: 4.5+ stars, 10+ recent reviews, 5 years in business. AZ neighborhoods: 1,054 correct.
