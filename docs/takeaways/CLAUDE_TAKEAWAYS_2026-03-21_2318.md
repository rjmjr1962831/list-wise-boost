# CLAUDE TAKEAWAYS — 2026-03-21 (Evening Session)

## Key Outcomes

### Stripe Checkout Wired End-to-End
- **stripe-webhook**: Fixed tier detection — now reads `badgeTier` from subscription metadata instead of broken amount thresholds ($150/$100 → $500/$300). SDK upgraded from v14.21.0 to v18.5.0, API version aligned to `2025-08-27.basil`.
- **complete-agent-subscription**: Now sets `badge_tier` and `badge_status` from checkout session metadata on payment success.
- **AgentDashboard**: "Upgrade Package" button navigates to `/funnel/:token/pricing` instead of dead `/visibility/coverage`.
- **Route fix**: `/funnel/:token/payment-success` now routes to `AgentPaymentSuccess` (new dark-themed page) instead of old `PaymentSuccess`.
- **Agent dashboard**: Added `?section=` deep-link support for tabs (e.g., `?section=badge` opens Web of Truth tab).
- Both edge functions deployed to Supabase.

### Payment Success Page Redesigned
- Full rewrite with dark theme matching funnel aesthetic.
- Shows tier badge, AIFS score (from `aifs_scores` table), and band label.
- Web of Truth CTA with pulsing tier orb — links to badge instructions page.
- "What just changed" section: verification active, data refresh cadence, AIFS uplift, richer AI payload.
- Inline question form (replaces mailto) — submits to `field_change_requests` as CRM task.
- Certified tier added to `TIER_META` (was missing — Certified agents saw "Audited tier is active").

### Founder → Cofounder Rename (9 files)
- Footer, FAQ, Founder.tsx, About.tsx, Index.tsx, PaymentsSecurity.tsx, PaymentSuccess.tsx, Press.tsx, AgentLanding.tsx.
- Schema.org `founder` arrays now include both Robert Maynard and Mark Garland.
- Display text changed, URL paths (`/about/founder`) kept to avoid broken links.

### Transparent Orb Badge PNGs
- Regenerated all 3 badge PNGs (`certified.png`, `audited.png`, `underwritten.png`) as SVG-rendered HAL 9000 orbs.
- Transparent backgrounds — no black box. Centered symmetrical lighting, no shadow.
- Pulsing animation on badge instructions page and payment success page.

### Pricing Page Redesigned (TierPricingCalculator)
- Simplified cards: Orb → Tier name → Net revenue hero number → AIFS score with inline band descriptions → Features → Expandable math → Price → CTA.
- Band descriptions shown inline (not tooltips): Invisible, Discoverable, Citable, Citable (local), Authoritative — each with plain-English description of what it means for the agent.
- Close rate changed from hardcoded 30% to default 10%, adjustable by agent.
- "Community (IRS 990 verified)" → "Community service".
- Font weights bumped to 500+ minimum, Playfair Display for tier names.
- CTA text: "Upgrade to Audited" → "Choose Audited — $300/mo".

### Source Count Language Removed Site-Wide (27 files, ~70 replacements)
- All references to "1,000+ sources", "10+ sources", "4 sources", "up to 20 sources" replaced with:
  - Listed/Certified: "Core credential verification"
  - Audited: "Expanded background research"
  - Underwritten: "Exhaustive background research"
  - Marketing: "exhaustive research into the agent's background, community service, career trajectory and history"
- Updated across React pages, edge functions, FAQ, AI feeds, public docs, llms.txt, llms-full.txt.

### Funnel Bug Fixes
- StepSuccess: `markets_covered` pulls from agent's `served_cities` instead of hardcoded `['Phoenix']`.
- Step3: Title placeholder "DDS, DMD" → "REALTOR, Broker, CRS".
- Step3: Back button goes to Step2b (credentials) instead of skipping it.
- Step7Pricing: AIFS default changed from 42 to 24 (true baseline without tier uplift).
- Step1 CTA: "Let's Verify Your Profile" → "See What AI Knows About You".
- Step5: "Please add at least one bundle" → "Please select at least one city area."
- Step6: "We verify these selections against public transaction records" → "Choose the neighborhoods where you've closed the most deals."
- Step4ReviewFinal: All fields now show always (not conditionally hidden).

### GEO Audit Remediation
- **C1**: coverage-stats now counts only cities/neighborhoods with qualifying agents (matching sitemaps). Dynamic counts script updated.
- **H1**: FAQ hardcoded city/neighborhood counts replaced with dynamic language.
- **H2**: `/why-ai-trusts-us` → 301 redirect to `/for-ai` in vercel.json.
- **H3**: `/login` → 301 redirect to `/agent-login`, footer link fixed.
- **H4**: Homepage OG image tag added.
- **H5**: `get_founder_profiles` added to mcp.json documentation.
- **M1**: All 10 ai-feed dates bumped to 2026-03-21.

### Email Bounce Handling
- 9 post-delivery bounces flagged: all agents set to `lead_status = 'email_bounced'`.
- CRM tasks created in `field_change_requests` for each bounced agent to find correct emails.
- Agents: Arsen Sarapinian, Brad Rawlins, Brenda Hayes, Brenda Reynolds, Brian Laughlin, Dianne Barrett, Farideh Farinpour, Frank Crandall, Freddy Cabral.

## Config / Infrastructure

- **Edge functions deployed**: stripe-webhook, complete-agent-subscription.
- **Stripe secrets confirmed**: STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET set in Supabase.
- **Badge PNGs regenerated**: 3 files in public/badges/ (transparent background, centered).
- **vercel.json**: Added redirects for /why-ai-trusts-us → /for-ai, /login → /agent-login.
- **CLAUDE.md**: Added `--dangerously-skip-permissions` launch instruction at top.

## New Rules or Docs

- **Founder → Cofounder**: All public-facing references to "Founder" changed to "Cofounder". Schema.org arrays include both cofounders.
- **No source counts**: Never reference specific source counts (1,000+, 10+, 4, 20). Use tier-appropriate depth language instead.
- **Close rate default is 10%**: Not 30%. Agent can adjust. Revenue projections must be defensible.
- **Coverage counts must match sitemaps**: coverage-stats, FAQ, /for-ai must all use the same filtered query (Sitemap Rule A).
- **AIFS default is 24** (baseline without tier uplift), not 42.

## Funnel Conversion Audit Findings (Not Yet Implemented)

### High-Impact Structural Changes Pending
1. **Collapse Steps 2+2b+3+4 into single accordion page** — cuts 3 page transitions, est. 20-30% drop-off reduction.
2. **Show AIFS uplift + revenue projection on Step 1** — agent sees the prize before doing the work.
3. **Add "email me this link" + auto-save + DB persistence** — close tab = lose everything is #1 structural risk.
4. **Add testimonial + competitor comparison + product preview** before pricing — zero social proof currently.
5. **StepSuccess is a dead end** — needs Web of Truth badge setup as primary CTA, not "Go to Homepage."

## Deprecated or Removed

- Old PaymentSuccess page (light theme, "You're on the list!" copy) — replaced by AgentPaymentSuccess at funnel payment-success route.
- "1,000+ sources" language everywhere.
- "Founder" as title (now "Cofounder").
- 30% close rate assumption.
- Hardcoded coverage counts in FAQ.
- Original badge PNGs with black backgrounds.
