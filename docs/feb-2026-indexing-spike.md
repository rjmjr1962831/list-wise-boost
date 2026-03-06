# Feb 2026 Indexing Spike — What to Protect

**GSC:** Indexed pages went from 320 (Feb 21) to **5,751** (Feb 24) in one day. Impressions rose from ~100/day to 1,000–1,500+/day and held through early March.

This doc records the likely causes so we don’t accidentally revert them.

---

## 1. Bot rendering (no Prerender / no Cloudflare cache)

- **Feb 20, 2026:** Cloudflare Worker cache read was **disabled**. Bot requests no longer hit KV; they go straight to Supabase Edge Functions.
- **Feb 20:** Prerender.io was replaced by Cloudflare Browser Rendering in `serve-bot-static-html`; list/agent pages are served by `serve-bot-list-html` and `serve-bot-agent-html` (live from Supabase).
- **Current flow:** Vercel rewrites for list/agent URLs → `/api/serve-clean-html` → Supabase `serve-bot-list-html` or `serve-bot-agent-html`. No Worker, no KV, no Prerender.io.

**Protect:** Do not re-enable a cache layer in front of the edge functions for bot traffic without a clear plan. Live HTML from the edge function is what Google is successfully crawling.

---

## 2. Sitemap: qualified-only (0-agent URLs excluded)

- **Arizona 0-agent geo fix:** Sitemap generation (`generate-sitemap`) includes only cities and neighborhoods that have **at least one qualified agent** (4.5+ stars, 10+ reviews). Zero-agent city/neighborhood URLs are no longer in the sitemap.
- **Effect:** Google discovers fewer dead-end URLs and spends crawl budget on pages that return real content.

**Protect:** Keep the qualified-only filter in `supabase/functions/generate-sitemap/index.ts` (Rule A: `qualifiedCityIdSet`, `get_neighborhood_ids_with_qualified_agents`). Do not revert to “all cities / all neighborhoods” in the sitemap.

---

## 3. Verification disclaimer and content

- Verification disclaimer was added to city/neighborhood bot HTML (serve-bot-list-html) and to the React list header.
- Merit gate copy is 4.5+ stars, 10+ verified reviews in the last 24 months, 5+ years experience sitewide.

**Protect:** Keep bot HTML substantive (merit box, disclaimer, agent list, JSON-LD). Thin or empty pages are more likely to be “discovered, not indexed.”

---

## 4. Timeline (for reference)

| Date       | Event |
|-----------|--------|
| Feb 20    | Worker cache read disabled; Prerender → Cloudflare Browser Rendering (serve-bot-static-html); Master doc: Cloudflare Worker cache deprecated. |
| Feb 21    | Add Cloudflare deprecation to master knowledge document. |
| Feb 24    | GSC indexed count jumps 320 → 5,751. Merge to main: verification disclaimer, Arizona 0-agent geo fix. |
| Mar 2     | Indexed 5,751; 12,698 not indexed; ~1,000 daily impressions. |

---

## 5. If indexing drops again

1. **Confirm bot flow:** `curl -A "Googlebot" https://www.top10lists.us/arizona/phoenix/top10realestateagents` → 200, full HTML, no empty shell.
2. **Confirm sitemap:** `https://www.top10lists.us/sitemap-cities.xml` and `sitemap-neighborhoods.xml` only list qualified cities/neighborhoods.
3. **Check Vercel rewrites:** List/agent paths must rewrite to `/api/serve-clean-html` with correct `fn` and `path`.
4. **Check Supabase:** Edge functions `serve-bot-list-html` and `serve-bot-agent-html` must be deployed and env (SUPABASE_URL, key) correct.

See also: `docs/GSC-404-noindex-5xx-remediation-plan.md` for 404, noindex, and 5xx handling.
