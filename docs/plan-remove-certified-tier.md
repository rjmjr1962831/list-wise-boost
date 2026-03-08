# Plan: Remove Certified Tier + New Pricing (Audited $300, Underwritten $500)

**Goal 1:** Remove Certified from the acquisition path (funnel, marketing, badge issuance). Keep the 58 existing certified agents at Certified tier with their full payload on listing pages. Do NOT issue new Certified badges.

**Goal 2:** Change pricing: Audited $100 → $300/mo, Underwritten $150 → $500/mo.

**Target state:**
- **Acquisition:** 3 tiers only — Listed (free), Audited ($300/mo), Underwritten ($500/mo). No one can select or become Certified.
- **Existing 58 agents:** Remain `current_tier = 'certified'`. Keep full Certified payload on listing pages. Do not issue new Certified badges.

---

## Phase 1: Data — No Migration

### 1.1 Do NOT migrate certified agents
- **Keep** `current_tier = 'certified'` for the 58 agents.
- **Keep** `certified` in `certification_tier` enum and `certification_pricing_config` (for display/artifact logic).
- No data migration required.

---

## Phase 2: Database & Supabase Functions

### 2.1 Edge Functions — KEEP certified for existing agents (listing/artifact)
| File | Changes |
|------|---------|
| `artifact-markdown/index.ts` | **Keep** certified tier logic. Existing certified agents continue to get full Certified payload. |
| `serve-bot-agent-html/index.ts` | **Keep** certified in tier maps. Certified agents keep full payload on listing pages. |
| `serve-bot-list-html/index.ts` | **Keep** certified handling for existing agents. |
| `pre-render-page/index.ts` | **Keep** certified agents section. Certified agents render with full payload. |
| `badge-image/index.ts` | **Do not issue new certified badges.** Existing 58 certified agents: keep full payload on listing pages. For badge image: either (a) keep certified.png for existing agents so existing badge links work, or (b) serve listed-style badge for certified. Confirm with Robert. |

### 2.2 Edge Functions — REMOVE certified from acquisition path
| File | Changes |
|------|---------|
| `funnel-select-tier/index.ts` | Remove `certified` from `validTiers`. Reject tier selection of certified. Only listed, audited, underwritten selectable. |
| `badge-issue/index.ts` | Do not issue badges for certified. Fallback for tier display: use `listed` instead of `certified` when describing "minimum" tier. |
| `sync-crm-to-instantly/index.ts` | Treat certified like listed for sync (or keep if needed for existing 58). |
| `instantly-sync/index.ts` | Same. |
| `sequence-enroll/index.ts` | Default to listed, not certified. |
| `methodology-payload/index.ts` | Marketing copy: 3 tiers (Listed, Audited, Underwritten). Certified not in acquisition messaging. |
| `list-maker-export/index.ts` | Certified can stay in export (existing agents). |

### 2.3 Migrations
- No migration for certified. Keep certified in enum and config for existing 58 agents.

---

## Phase 2B: Pricing Change — Audited $300, Underwritten $500

### 2B.1 Database
| Item | Change |
|------|--------|
| New migration | `supabase/migrations/YYYYMMDD_audited_300_underwritten_500.sql` |
| `certification_pricing_config` | `UPDATE ... SET monthly_price = 300 WHERE tier = 'audited'` |
| | `UPDATE ... SET monthly_price = 500 WHERE tier = 'underwritten'` |
| Comment | Update professionals.current_tier comment to $300/$500 |

### 2B.2 Stripe / Checkout
| File | Change |
|------|--------|
| `supabase/functions/create-agent-checkout/index.ts` | `BADGE_PRICES: { audited: 300, underwritten: 500 }` (line 36) |

### 2B.3 React — Funnel Pricing
| File | Change |
|------|--------|
| `src/pages/funnel/Step7Pricing.tsx` | `DEFAULT_PRICES`: audited monthly_price 300, underwritten 150 → 500 |

### 2B.4 FAQ & Marketing Copy
| File | Change |
|------|--------|
| `src/data/faqFull.ts` | "Audited is 300 dollars per month. Underwritten is 500 dollars per month." |
| `src/data/faqTop10.ts` | Same |
| `public/api/faq/full.json` | Regenerate via `npm run generate:faq` (or manual update) |

### 2B.5 Static HTML & Edge Functions (upgrade hints)
| Location | Change |
|----------|--------|
| `supabase/functions/serve-bot-list-html/index.ts` | "Audited ($300/mo) or Underwritten ($500/mo)" |
| `public/clean-room/*.html` | Same in upgrade-hint paragraphs |
| `public/**/top10realestateagents*.html` | Same |
| `test-static-for-ai.html` | Same |

### 2B.6 Docs & Methodology
| File | Change |
|------|--------|
| `src/pages/MethodologyPage.tsx` | "Audited ($300/mo)", "Underwritten ($500/mo)" |
| `docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md` | Section 3 tier table: Audited $300, Underwritten $500 |
| `public/ai-feed/certification-logic.md` | Same |
| `public/ai-feed/for-ai.md` | Same |
| `docs/ai-feed-refactor-proposal.md` | Underwritten $500 (if referenced) |

### 2B.7 Schema.org / JSON-LD (privacy, about, etc.)
| Files | Change |
|-------|--------|
| `public/privacy/index.html`, `public/about/index.html`, `public/texas/index.html`, `public/payments-security/index.html`, `public/ai-liability/index.html`, `test-static-*.html` | Only change if they mention "$100" or "$150" for our tiers. The "RealTrends $195/year" is a different product — do NOT change. |

### 2B.8 Existing Subscribers
- **Consider:** Agents already on Audited ($100) or Underwritten ($150) — Stripe subscriptions continue at their current price until they change plan. New signups and plan changes use $300/$500. No migration of existing Stripe subscriptions required unless Robert wants to grandfather or force-upgrade.

---

## Phase 3: React / Frontend — Acquisition Only

**Rule:** Remove Certified from funnel, pricing, and marketing. Keep Certified in display components that render listing pages (so the 58 agents show correctly).

### 3.1 Funnel & Pricing (REMOVE certified from options)
| File | Changes |
|------|---------|
| `src/pages/funnel/Step7Pricing.tsx` | Remove certified as selectable tier. Two paid tiers only: Audited, Underwritten. Listed = free. Remove `handleSelectCertified`, certified from `DEFAULT_PRICES`, `TIER_META`, etc. |
| `src/pages/funnel/Step1Intro.tsx` | Marketing: "Listed, Audited, or Underwritten" |
| `src/pages/funnel/StepSuccess.tsx` | Remove Certified from success messaging |

### 3.2 Display Components (KEEP certified for listing pages)
| File | Changes |
|------|---------|
| `src/components/AgentPayloadBlock.tsx` | **Keep** certified in tier order (existing agents). |
| `src/components/NeighborhoodExpertPage.tsx` | **Keep** certified in tier order and label map. |
| `src/hooks/useAreaAgents.ts` | **Keep** certified in `tierOrderFallback`. |

### 3.3 Marketing / Admin (REMOVE certified from acquisition messaging)
| File | Changes |
|------|---------|
| `src/pages/VisibilityTiersPage.tsx` | Marketing: 3 tiers. Certified not offered. |
| `src/pages/FAQ.tsx` | Tier table: Listed, Audited, Underwritten. Optional footnote: "Legacy Certified agents remain." |
| `src/pages/admin/AdminDemo.tsx` | "Listed, Audited, or Underwritten" |
| `src/pages/staging/BadgeLevelsPreview.tsx` | **Keep** certified in preview (existing agents can be viewed). |
| `src/components/crm/ListMaker.tsx` | **Keep** Certified filter (existing 58 agents). |
| `src/pages/admin/crm/Leads.tsx` | **Keep** certified in tier color map. |
| `src/pages/BadgeInstructionsPage.tsx` | Fallback can stay; certified agents may still have badges. |

### 3.4 CleanRoom
| File | Changes |
|------|---------|
| `src/pages/CleanRoom.tsx` | **Keep** `#certified-agents` and Certified tier display for existing agents. |

---

## Phase 4: Static HTML — KEEP Certified

**Do NOT change** static HTML for certified agents. The 58 agents have `agent-certified`, `badge-certified`, "Certified" badge text. Keep as-is so they display with full payload.

- `public/clean-room/*.html` — no changes for certified agent markup
- `public/**/top10realestateagents*.html` — no changes for certified agent markup
- `public/badges/certified.png` — **keep** for existing certified agents' badges

---

## Phase 5: Docs & AI Feed — Marketing = 3 Tiers

### 5.1 AI Feed
| File | Changes |
|------|---------|
| `public/ai-feed/certification-logic.md` | Marketing: 3 tiers. Add note: "Legacy Certified agents (58) retain Certified payload on listing pages; no new Certified issuances." |
| `public/ai-feed/tier-certified.md` | Keep or add deprecation note: "No new issuances; existing agents grandfathered." |
| `public/ai-feed/artifact-payload-structure.md` | Tier status: Listed | Audited | Underwritten. Certified exists for legacy. |
| `public/ai-feed/for-ai.md` | Marketing: 3 tiers. |

### 5.2 Other Docs
| File | Changes |
|------|---------|
| `docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md` | Section 3: Listed, Audited, Underwritten. Note: "Legacy Certified (58 agents) grandfathered; full payload on listing pages; no new badges." |

---

## Phase 6: FAQ & Schema

### 6.1 FAQ
| File | Changes |
|------|---------|
| `src/data/faqFull.ts` | Marketing: 3 tiers (Listed, Audited, Underwritten). Optional: "Legacy Certified agents remain." |
| `src/data/faqTop10.ts` | Same. |

---

## Phase 7: Scripts & API

### 7.1 Scripts
| File | Changes |
|------|---------|
| `scripts/export-active-confirmed-agents-csv.ts` | **Keep** certified; do not overwrite existing certified agents. |
| `api/badge/[agentId].js` | **Keep** certified handling for existing agents. |

---

## Phase 8: Exclusions (Do NOT Change)

- "PCI Level 1 certified", "Luxury Home Certified", "Board-certified" — non-tier uses.
- Listing pages, artifact-markdown, serve-bot-agent-html — keep certified for existing 58.

---

## Execution Order

1. **Phase 2B** — Pricing: migration (certification_pricing_config), create-agent-checkout, Step7Pricing, FAQ, serve-bot-list-html, static HTML, MethodologyPage, docs
2. **Phase 2** — Edge functions (funnel-select-tier: reject certified; badge-issue: no new certified)
3. **Phase 3** — React (funnel/pricing only; keep display components)
4. **Phase 5** — Docs
5. **Phase 6** — FAQ
6. **Verification** — Funnel cannot select certified; listing pages show certified agents; new signups see $300/$500

---

## Pricing Verification Grep

```bash
# Find remaining $100/$150 tier references (exclude RealTrends $195/year, $100M, etc.)
rg "(\$100|\$150)/mo|100 dollars per month|150 dollars per month" --type-add 'code:*.{ts,tsx,html,md,json}' -t code
```

---

## 58 Certified Agents — Preservation Checklist

- [ ] No migration. `current_tier = 'certified'` unchanged.
- [ ] artifact-markdown serves full Certified payload for certified agents
- [ ] serve-bot-agent-html, pre-render-page, listing pages show certified agents with full payload
- [ ] badge-image: keep certified.png; existing certified agents keep badges (or document: no new badges, existing keep)
- [ ] funnel-select-tier: certified not in validTiers; no new signups to certified
- [ ] Step7Pricing: certified not offered
