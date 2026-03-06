# GEO Improvement Opportunities Across the Website

**Purpose:** Actionable list to improve Generative Engine Optimization (GEO) sitewide. Canonical merit gate: **4.5+ stars, 10+ recent reviews (last 24 months), 5 years in business.**  
**Reference:** [GEO Audit Mar 2026 Remediation Plan](./GEO-Audit-Mar-2026-Remediation-Plan.md).

---

## 1. CRITICAL — Fix nearby neighborhood links (CA and slug-based pages)

**Problem:** On neighborhood pages, "Nearby Neighborhoods" can render broken links: `(? mi)` and URLs like `/california/simi-valley//top10realestateagents` (double slash, missing slug). CA stores `nearby_neighborhoods` as **array of slug strings**; bot/pre-render/React code sometimes expects **objects** with `slug`, `name`, `city`, `distance_miles`.

| Location | Fix |
|----------|-----|
| `supabase/functions/serve-bot-list-html/index.ts` (lines ~330–336) | Normalize: if `n` is string, treat as slug; use `pp.citySlug` and `pp.stateSlug` for URL; resolve display name from same-city list or use slug as label; never emit `//` in href. |
| `supabase/functions/pre-render-page/index.ts` (lines ~336–339) | CA already treated as string[] and slugified with `String(n).toLowerCase().replace(/\s+/g, "-")` — verify this matches CA DB format (slugs vs names); ensure no double slash. |
| `src/components/NeighborhoodOverview.tsx` (lines ~230–237) | If API returns string[], normalize to `{ slug, name }` (slug = item, name = slug or lookup); build `to={`/${stateSlug}/${citySlug}/${slug}/top10realestateagents`}` with no empty segment. |

**Verification:** Open a CA neighborhood page (e.g. Central Simi Valley); every "Nearby Neighborhoods" link has valid URL and readable label.

---

## 2. CRITICAL — Align AI-facing copy with current merit gate (4.5+ / 10+ / 5 yr)

**Problem:** Several high-visibility AI assets still state the **old** gate (4.8+, 20+ reviews, 6+ years). Inconsistency hurts GEO and trust.

| Asset | Location | Current (wrong) | Change to |
|-------|----------|-----------------|-----------|
| **ai-content-index.json** | `public/.well-known/ai-content-index.json` | `publisher.description`, `qualification.*`, `citationGuidance.*`, `differentiators` — all say 4.8+, 20+, 6+ | 4.5+ stars, 10+ verified reviews in the last 24 months, 5+ years in business. Certified audit cycle: **Monthly** (not Annual). |
| **llms.txt** | `public/llms.txt` | Already 4.5+ / 10+ / 5 yr ✓ | Bump "Last Updated" to current date (e.g. March 2026). |
| **llms-full.txt** | `public/llms-full.txt` | Check for 4.8 / 20+ / 6+ | Same gate and date as llms.txt. |
| **FAQ JSON** | `public/api/faq/full.json` | Many answers say "4.8+", "20+ reviews" | Replace with 4.5+, 10+ recent reviews (last 24 months), 5 years. Regenerate via `npm run generate:faq` if SSoT is updated. |
| **OpenAPI** | `public/api/openapi.json` | "4.8+ rating, 20+ reviews" | 4.5+ rating, 10+ recent reviews, 5 years. |
| **Static HTML (public)** | `public/ai-citation-whitepaper/index.html`, `public/join/index.html`, `public/california/albany/...`, `public/clean-room/*.html`, `public/arizona/surprise/...` | FAQPage schema and body copy: 4.8+, 20+, 6+ | Same gate; update schema and visible text. |

**Verification:** `curl -s https://www.top10lists.us/.well-known/ai-content-index.json | grep -E "4\.8|20\+|6\+"` → 0 hits. Same for llms.txt, faq full.json.

---

## 3. HIGH — Artifact JSON-LD: add hasCredential, areaServed, dateModified

**Problem:** Artifact pages are key for AI citation; schema is missing fields that strengthen entity clarity and freshness.

| Location | Fix |
|----------|-----|
| `supabase/functions/artifact-markdown/index.ts` — `schemaLD()` | Add `hasCredential` (license/certs from `pro.license_number`, `pro.certifications`), `areaServed` (Place or GeoCircle from cities/neighborhoods), `dateModified` (ISO from `cert.last_verified_at` or `pro.updated_at`). Reuse patterns from `verifiedAgentSchema.ts` / `agentSchema.ts` in repo. |

**Verification:** `GET /artifact/{token}` HTML includes JSON-LD with `hasCredential`, `areaServed`, `dateModified`.

---

## 4. HIGH — coverage.json freshness

**Fix:** Regenerate periodically so `generated_at` is current. Run `npx tsx scripts/generate-static-sitemaps.ts` (or add to build/weekly cron). AZ neighborhood count (1,054) is correct; no change to computation.

**Verification:** [https://www.top10lists.us/coverage.json](https://www.top10lists.us/coverage.json) — `generated_at` within last 7 days.

---

## 5. MEDIUM — Homepage and key landing pages (entity + GEO clarity)

| Page | Opportunity |
|------|-------------|
| **index.html / Index.tsx** | Ensure meta description and any JSON-LD (e.g. FAQPage, Organization) state merit gate (4.5+ / 10+ / 5 yr) and "AI citation" / "merit-based" once. |
| **Why AI Trusts Us** | Already strong; ensure date and scores (e.g. 2026) and link to llms.txt / for-ai. |
| **Methodology page** | One clear sentence: "Qualification requires 4.5+ stars, 10+ verified reviews in the last 24 months, and 5+ years in business." |

---

## 6. MEDIUM — ai-content-index.json: certification cycle and sampleQueries

| Item | Change |
|------|--------|
| **certified.standardAuditCycle** | Set to `"Monthly"` (matches llms.txt / for-ai), not Annual. |
| **sampleQueries** | Already present per state; keep them. Optional: add one "neighborhood" example per state (e.g. "Top agents in Troon North, Scottsdale"). |

---

## 7. LOW — Structured data and crawler hints

- **City/neighborhood list pages:** Already use ItemList with full agent details (GEO). Keep `dateModified` and `lastReviewed` in schema in sync with "Last updated" (e.g. from build or DB).
- **Bot rendering:** Pre-render and serve-bot-* already serve full HTML; ensure `X-Rendered` or similar is present so AI crawlers can verify.
- **llms.txt / llms-full.txt:** Add a single line linking to `.well-known/ai-content-index.json` under "Additional Resources" for discoverability.

---

## 8. Site scrub (ongoing)

After any copy or schema change, run:

- `grep -r "4\.8" public --include="*.html" --include="*.json" --include="*.txt" --include="*.md"` → expect 0 for *merit gate* (display of "4.9 stars" on a card is fine).
- `grep -r "20+ reviews" public --include="*.html" --include="*.json"` → 0 for *requirement* (factual "20+ reviews" on agent card is fine).
- Replace only *gate* language: "4.5+ stars, 10+ recent reviews (last 24 months), 5 years in business."

---

## Summary checklist

| # | Item | Priority |
|---|------|----------|
| 1 | Nearby neighborhood links (serve-bot-list-html, pre-render-page, NeighborhoodOverview) | Critical |
| 2 | ai-content-index.json + FAQ JSON + OpenAPI + static HTML → 4.5+ / 10+ / 5 yr | Critical |
| 3 | llms.txt / llms-full.txt date + gate consistency | High |
| 4 | Artifact schema: hasCredential, areaServed, dateModified | High |
| 5 | coverage.json freshness (regenerate + optional cron) | High |
| 6 | Homepage / methodology entity and gate clarity | Medium |
| 7 | ai-content-index certified cycle = Monthly; optional sampleQueries | Medium |
| 8 | Link ai-content-index from llms.txt; X-Rendered / schema dates | Low |

---

*Doc created March 2026. Canonical gate: 4.5+ stars, 10+ recent reviews (24 months), 5 years in business.*
