# Claude Code Takeaways — 2026-03-23

## Session Focus
Complete sandbox/production funnel overhaul. Replaced the old 8-step funnel with a streamlined 5-step flow, rebuilt California city bundles, and deployed to production.

---

## Funnel Overhaul (Sandbox → Production)

### New 5-Step Flow
1. **Your Listing** — AI surface stats, value prop nugget, "Certify Your Listing" CTA
2. **Contact** — Email, 3 phone fields (mobile/business/other), website — each with publish toggle sliders and per-field auto-save on blur. US phone formatting on blur.
3. **Cities** — Hierarchical city selector with 3-level expander (region → sub-region → individual city checkboxes). AZ uses flat bundles with Add buttons; CA uses full hierarchy.
4. **Neighborhoods** — Search filtered to only cities selected in step 3. Nearby suggestions also filtered.
5. **Tier/Pricing** — 3 tier cards with revenue calculator. Monthly/annual toggle inside each paid card. CTAs simplified to "Stay with Free" / "Choose Audited" / "Choose Underwritten".

### Key Decisions
- **No profile photo** in funnel — AI doesn't use photos
- **No "What AI sees" cards** on tier page — removed all three detail columns
- **No "Stay with your free listing"** exit link — removed from tier page
- **No AIFS score context bar** on tier page
- **Nugget always above title** on every step (consistent pattern)
- **"Congratulations" headline removed** from step 1
- **Dev mode**: success page auto-reverts agent to Listed, clears all changes, "Test Again" button. Snapshot on step 1 entry, restore on completion.

### Production Deployment
- `/funnel/:token/*` now serves the new funnel (same components as `/sandbox/:token/*`)
- `useBasePath()` hook detects `/funnel` vs `/sandbox` for path-agnostic navigation
- `sandbox` added to Vercel SPA rewrite pattern (was 404-ing on refresh)
- Old funnel routes (`/review-1`, `/review-credentials`, `/review-2`, `/review-final`, `/pricing`) replaced with new paths (`/contact`, `/cities`, `/neighborhoods`, `/tier`)

---

## California City Bundles Rebuild

### Before: 11 bundles, ~40 city slugs (2-6 cities each)
### After: 36 sub-regional bundles, 467 verified city slugs

- **Greater LA**: 8 sub-bundles (West LA/Beach Cities, Hollywood/Mid-City, SFV, Pasadena/Foothills, South Bay, Downtown/East LA, Santa Clarita/North LA, Long Beach/Gateway)
- **Orange County**: 4 sub-bundles (North, South Coastal, Central, South Inland)
- **Inland Empire**: 4 sub-bundles (West IE, East IE/Riverside, Temecula Valley, Mountain/High Desert)
- **San Diego**: 5 sub-bundles (Coastal, Central, North County Inland, South Bay, East County)
- **SF Bay Area**: 4 sub-bundles (SF, East Bay, Peninsula, Marin)
- **South Bay/Silicon Valley**: 2 sub-bundles
- **Sacramento**: 1 bundle (metro)
- **Central Valley**: 2 sub-bundles (North/South)
- **Central Coast**: 3 sub-bundles (Ventura County, Santa Barbara, SLO/Monterey/Santa Cruz)
- **Desert**: 1 bundle (Coachella Valley — Palm Springs, Palm Desert, Rancho Mirage, etc.)
- **North State**: 1 bundle + Wine Country split out

### Critical Fix: Supabase 1,000-Row Limit
CA has 1,650+ cities. The city query was only returning the first 1,000 alphabetically — everything past "S" was missing (San Francisco, Santa Monica, etc.). Fixed with pagination loop.

---

## BundlesPanel Component Redesign

### Hierarchical Mode (CA and any state with categories)
- **Level 1**: Region headers (Greater Los Angeles, Orange County, etc.) — click to expand
- **Level 2**: Sub-region headers (West LA, Hollywood, etc.) — click to expand
- **Level 3**: Individual city checkboxes — toggle each city on/off
- **Single-bundle optimization**: Categories with only one bundle (e.g., AZ "Luxury Markets") skip the middle level — cities show directly under the header

### Flat Mode (AZ without categories)
- Table layout with bundle name, city count, Add button
- Chevron expander to reveal city list

### Selected count badges at every level

---

## Edge Function Updates

### update-professional-field
- Added `phone_numbers` and `website_visible` to allowed fields
- All funnel saves now go through this edge function (not direct `.update()`) to bypass RLS

### Database Changes
- `website_visible` boolean column added to `professionals` table (default true)
- Sarah Park test agent: populated with fake bot crawl data (5,812 surfaces across 8 bots), moved to Scottsdale AZ, filled ratings/license/website/AIFS score

---

## Pricing Calculator Updates
- Default deal size: $500k → $750k
- Default close rate: 10% → 20%
- Heading: "Adjust to your market" → "Calculate your first year revenue uplift"
- Hero label: "est. net revenue / year" → "1st Year Rev Uplift" (bold, white) with "(Ttl Rev Uplift - Top10 investment)" and "Estimated" underneath
- Monthly/annual toggle moved from above cards into each paid card above the price
- Prices removed from CTA button text

---

## Email Campaign Status
- "Listed 7d crawl" campaign resumed (was paused). 2,690 emails remaining across 4 sender accounts (~670 each).
- Daily ramp: 40 base × 1.10^days. At day 3 = ~48/box, ~192/day total.
- Queue should drain by Mar 31 – Apr 1 (~9-10 days with compound ramp).

---

## Standing Rules Reinforced
- **Supabase 1,000-row limit** bit us again on CA cities. Always paginate tables that can exceed 1,000 rows.
- **RLS blocks anonymous updates** — funnel saves must go through edge functions with service role, not direct Supabase client `.update()`.
- **Vercel SPA rewrite** must include any new client-side route prefix (sandbox was missing, caused 404 on refresh).
