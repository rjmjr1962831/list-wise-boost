# Claude Code Takeaways -- 2026-03-17

## Key Outcomes

### Bot Analytics Review
- Analyzed bot crawl dashboard at staging.top10lists.us/a/bot-analytics
- Meta-ExternalAgent dominates with 329,554 visits (83.2%) of 396,104 total in 30 days
- This is Meta's AI training crawler (feeds Llama/Meta AI), NOT the link preview bot (FacebookExternalHit, only 46 visits)
- Meta AI is the largest AI assistant by reach (WhatsApp 2B+, Instagram 2B+, Facebook 3B+ users)
- Zero marginal cost -- Vercel only incurs material costs on build minutes, not edge function invocations
- Full bot breakdown: AhrefsBot 6.2%, Applebot 3.4%, Bingbot 2.3%, Googlebot 2.3%, ByteSpider 0.9%, ChatGPT-User 0.3%, GPTBot 0.2%, PerplexityBot 0.2%

### AIFS Data Analysis (3,369 agents scored via geo_audit_results)
- Band distribution: 81% Fragmented (avg 49), 14% Recognized (avg 72), 5% Invisible (avg 32), 0.03% High Fidelity (1 agent at 87)
- Average scores by tier: Listed 51, Certified 54, Audited 71, Underwritten 79
- Pillar averages: Authority 15/25, Social 13/25, Identity 11/25, Citability 1/25, Technical 0/25
- Technical pillar negative for 61% of agents (2,069 agents) -- biggest drag on fleet score
- Gap analysis: 99.97% missing schema markup, 99.97% missing GBP, 96.1% stale reviews, 83.2% missing personal website, 72.1% missing LinkedIn
- Data completeness: 99.97% have Zillow URL, 93.7% have email, 16.5% have LinkedIn, 0.9% have Facebook
- aifs_scores table was never deployed to Supabase -- all AIFS data lives in geo_audit_results

### AI Maximization Plan -- Two Sample Reports Written
- Created personalized AI Footprint Maximization Plans for two agents:
  - **DeeAnna Penna** (Sierra Vista, AZ) -- AIFS 49, Fragmented. Near-zero web presence beyond Zillow/Top10Lists. 9 gaps identified.
  - **Anthony Omar Alonzo** (Northridge, CA) -- AIFS 69, Recognized. Strong presence (10 platforms, 117 reviews, 30 years) but missing GBP, schema, name inconsistency, stale reviews.
- Plans are "you don't have to pay us" documents: detailed descriptions of what to fix, not how-to guides
- Each plan includes: current AIFS score + band, 5-pillar breakdown, platform presence checklist, personalized gap list (ordered by impact), tier score projections (Listed/Certified/Audited/Underwritten)
- Saved to docs/ai-maximization-plan-deeanna-penna.md and docs/ai-maximization-plan-anthony-alonzo.md

### AIMaxPlan Dashboard Component Built
- New component: `src/components/agent/AIMaxPlan.tsx` (~460 lines)
- Added as "AI Max Plan" tab in agent dashboard (AgentDashboard.tsx) with Sparkles icon
- Pulls data from geo_audit_results via run_sql RPC
- UI sections:
  1. Dark gradient header with AIFS score hero + color-coded spectrum bar
  2. Five Pillars breakdown with progress bars (Authority, Social, Identity, Citability, Technical)
  3. "Where AI Systems Find You" -- platform presence checklist with green/red indicators
  4. "Gaps Holding You Back" -- expandable cards with Critical/High/Medium impact tags and detailed descriptions
  5. Score Projections -- 4-column grid (Listed/Certified/Audited/Underwritten) with point lift indicators
  6. Footer -- "free and earned, no cost no obligation"
- Test agent (Marcus Chen) updated with Alonzo's geo_audit data via REST PATCH for visual testing

## Config / Infrastructure
- No new env vars, secrets, or edge functions deployed
- geo_audit_results row for Marcus Chen (149c7dfd-c70a-4a72-ad51-c991fef7ffb4) updated with Alonzo's scores/gaps for testing
- Dev server running on localhost:8084

## New Rules or Docs
- Memory saved: 4-tier business model (feedback_4tier_model.md) -- Certified is ACTIVE (reactivated 2026-03-12), not legacy. SSoT Section 3 is stale on this point. Always present 4 tiers: Listed (free, annual), Certified (free, quarterly), Audited ($300/mo, monthly), Underwritten ($500/mo, daily).

## New Functions / Scripts
- `src/components/agent/AIMaxPlan.tsx` -- AI Maximization Plan dashboard component. Loads geo_audit_results via run_sql, renders personalized gap analysis and score projections. Expandable gap items with impact classification.
- `docs/ai-maximization-plan-deeanna-penna.md` -- Sample AI Max Plan (Fragmented agent, Sierra Vista AZ)
- `docs/ai-maximization-plan-anthony-alonzo.md` -- Sample AI Max Plan (Recognized agent, Northridge CA)

## Deprecated or Removed
- Nothing deprecated this session
- Note: aifs_scores table migration (20260315000000_aifs_scores.sql) was never applied to Supabase -- all AIFS scoring data currently lives in geo_audit_results. The planned batch-aifs-score edge function was never deployed.
