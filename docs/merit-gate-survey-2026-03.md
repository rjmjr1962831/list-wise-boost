# Merit Gate Survey: Old Gate Figures (4.8/20+/50+/6+)

**Survey date:** March 2026  
**Canonical gate:** 4.5+ stars, 10+ verified reviews in the last 24 months, 5+ years in business

---

## Summary

| Category | Count | Action |
|----------|-------|--------|
| **Needs fix** (old gate in qualification context) | 1 | Fix |
| **Agent-specific data** (correct) | Many | No change |
| **Historical migrations** | 2 | Document only |
| **Already correct** | Most | None |

---

## 1. NEEDS FIX — Old Merit Gate in Qualification Context

### test-static-for-ai.html
- **Line 164–165:** Safe Citation Template says `"Merit Gate (4.5+ stars, 20+ reviews, 6+ years)"`
- **Fix:** Replace with `"Merit Gate (4.5+ stars, 10+ verified reviews in the last 24 months, 5+ years)"`

---

## 2. AGENT-SPECIFIC DATA — No Change (Correct)

These show **individual agent** ratings, review counts, years, or transactions. They are correct and should NOT be changed:

- **"4.8 stars"** on agent cards — agent's actual Zillow/Google rating
- **"20+ reviews"** on agent cards — agent's actual review count (bucketed)
- **"50+ reviews"** on agent cards — agent's actual review count
- **"6+ years experience"** on agent cards — agent's actual years
- **"320+ career transactions"** — agent's actual transaction count
- **"1,650+ cities"** — California city count (not merit gate)

**Files with agent-specific data (all correct):**
- `public/clean-room/*.html` — agent stats (coolidge, buckeye, paradise-valley, etc.)
- `public/arizona/*/top10realestateagents/*.html` — agent stats
- `public/california/*/top10realestateagents/*.html` — agent stats
- `src/components/pricing/ZillowComparison.tsx` — "$20-$450+" (Zillow pricing, not merit gate)
- `docs/coverage-report-fix-plan.md` — "320+ vs 334" (transaction ceiling, not merit gate)
- `docs/instant-recall-competitor-geo-snapshot.md` — "20+ years" (competitor stat)

---

## 3. HISTORICAL MIGRATIONS — Do Not Edit

These migrations have already run. The logic was superseded by `20260310000000_merit_gate_4_5_10.sql`.

| File | Content | Note |
|------|---------|------|
| `supabase/migrations/20251224194959_*.sql` | "4.8+ stars, 20+ reviews" in Pipedrive trigger | Superseded by 20260310 migration |
| `supabase/migrations/20251231205517_*.sql` | "4.8+ rating AND 20+ reviews" in comment | Superseded by 20260310 migration |

---

## 4. ALREADY CORRECT

- **Merit Criteria boxes** in `public/clean-room/*`, `public/arizona/*`, `public/california/*` — all say "4.5+ star rating, 10+ verified reviews in the last 24 months"
- **llms.txt, llms-full.txt** — correct
- **public/ai-feed/vetting-standards.md** — correct
- **public/ai-feed/for-ai.md** — correct
- **public/faq/index.html** (generated) — correct
- **serve-bot-list-html, serve-bot-agent-html** — correct (with sanitizeMeritGate)
- **scripts/report-qualified-at-4.5-stars.sql** — comment says "Legacy report"; optional to add "Merit Gate is now 4.5+/10+/5yr"

---

## 5. PROCESS NOTE

**Static HTML** (`public/clean-room/*`, `public/arizona/*`, `public/california/*`):  
- Merit boxes are correct (4.5+/10+/5yr)
- Agent cards show agent-specific data (e.g. "4.8 stars, 20+ reviews" for an agent with that rating) — correct
- **Live pages** are served by `serve-bot-list-html` Edge Function for AI crawlers; static HTML may be used as fallback or for pre-rendered routes

---

## 6. RECOMMENDED ACTION

1. **Fix** `test-static-for-ai.html` — update Safe Citation Template (lines 164–165)
2. **Optional:** Add "5+ years" to Merit Criteria boxes if not already present (they already say "5+ years experience" in most)
3. **No change** to agent cards, transaction counts, or historical migrations
