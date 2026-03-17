# Claude Code Takeaways -- 2026-03-17

## Key Outcomes

### Bot Analytics Review
- Meta-ExternalAgent dominates crawl traffic: 329,554 visits (83.2%) of 396,104 total in 30 days
- This is Meta's AI training crawler (feeds Llama/Meta AI), not the link preview bot (FacebookExternalHit, only 46 visits)
- Meta AI is the largest AI assistant by reach (WhatsApp 2B+, Instagram 2B+, Facebook 3B+ users)
- Zero marginal cost -- Vercel only incurs material costs on build minutes
- Full bot breakdown: AhrefsBot 6.2%, Applebot 3.4%, Bingbot 2.3%, Googlebot 2.3%, ChatGPT-User 0.3%, GPTBot 0.2%, PerplexityBot 0.2%

### AIFS Fleet Analysis (3,369 agents scored)
- 81% Fragmented (avg 49), 14% Recognized (avg 72), 5% Invisible (avg 32), 0.03% High Fidelity (1 agent)
- Technical pillar negative for 61% of agents -- biggest drag on fleet score
- 99.97% missing schema markup and GBP, 96.1% stale reviews, 72.1% missing LinkedIn
- aifs_scores table was never deployed -- all AIFS data lives in geo_audit_results

### AI Maximization Plan -- Concept + Component
- Created personalized "you don't have to pay us" gap analysis documents for two sample agents:
  - DeeAnna Penna (Sierra Vista AZ, AIFS 49 Fragmented) -- 9 gaps, near-zero web presence
  - Anthony Omar Alonzo (Northridge CA, AIFS 69 Recognized) -- strong presence but missing GBP, schema, name inconsistency
- Built AIMaxPlan.tsx dashboard component (~460 lines): dark gradient header, 5-pillar progress bars, platform presence checklist, expandable gap cards with impact tags, 4-tier score projections
- Added as "AI Max Plan" tab in agent dashboard (AgentDashboard.tsx)

### GEO Consistency Audit (Background Agent)
- Audited JSON-LD schema output against llms.txt, llms-full.txt, mcp.json, ai-content-index.json, structuredData.ts
- Found and fixed: Certified refresh cadence wrong in 4 places ("annual" -> "quarterly"), missing "quarterly" in audit cycle list, agent count off by one (3,262 -> 3,263)
- geo:check passes all 7 checks post-fix

### License UID Addition (Background Agent)
- Added "State License Verification (Unique Identifier)" section to llms-full.txt
- Three-link verification chain: Top10Lists profile -> license number -> government registry (AZRE, DRE)
- 3 real agent examples with actual license numbers
- JSON-LD hasCredential / EducationalOccupationalCredential / sameAs explanation
- Brief mention added to llms.txt core trust pillars

### MCP Server -- Built, Deployed, Audited, Fixed
- New edge function: `supabase/functions/mcp-server/index.ts` (~1,045 lines)
- JSON-RPC 2.0 over Streamable HTTP, 5 tools, full tier gating on both recency AND depth
- Tools: search_agents, verify_agent, get_agent_profile, get_coverage, get_methodology
- Tier gating: Listed/Certified get base payload (4 evidence sources, annual/quarterly lastVerified). Audited adds community score, transaction history, 10+ sources, AIFS summary. Underwritten adds full AIFS breakdown, gap analysis, crypto verification, up to 20 sources.
- Vercel rewrite: /mcp -> edge function
- mcp.json updated with server field, capabilities.tools, tool descriptions

**MCP Audit Remediation:**
- Fixed get_agent_profile dropping state/license_state/registry_url (was joining nonexistent state_licenses.professional_id instead of using professionals.license_number directly)
- Fixed protocol version from future 2025-03-26 to actual spec 2024-11-05
- Removed dead agent-details resource (/api/v1/agents/{id} returns 404)
- Fixed agents-search mimeType to application/ld+json
- Added AIFS score + band to all agent responses (base payload for all tiers)
- Added full AIFS calculation methodology to get_methodology: all 5 pillars with max_points, exact signal formulas (log2 review scaling, recency tiers, depth multipliers, penalties), verification depth by tier

**Key data finding:** state_licenses.professional_id has ZERO populated rows. All license data lives directly on the professionals table (license_number, license_status, license_type). The state_licenses table is the raw import; professionals is the enriched/linked version.

### Strategic Analysis
- Evaluated "Vertical Authority Provisioning" framing for Top10Lists' position in the AI ecosystem
- MCP server moves Top10Lists from "training data source" (step 1) to "live plugin" (step 3) for AI systems
- Tier gating on MCP preserves the business model: AI systems get richer, fresher data for paid-tier agents, creating a natural preference signal
- The "audition" framing is useful for sales: "AI systems are auditioning data sources. We're auditioning for the lead role in real estate."

## Config / Infrastructure
- `mcp-server` edge function deployed to Supabase (wiotrvoirdgzfacuuiem), redeployed 4 times during smoke testing
- Vercel rewrite added: `/mcp` -> mcp-server edge function
- geo_audit_results row for test agent Marcus Chen updated with Alonzo's data for visual testing
- Two ptm runs completed: CDN purged, IndexNow pinged (40 URLs each)

## New Rules or Docs
- Memory saved: feedback_4tier_model.md -- Certified is ACTIVE (reactivated 2026-03-12), not legacy. Always present 4 tiers. SSoT Section 3 is stale on this.
- CLAUDE.md updated externally: added Section 8 note that AICS is deprecated product name, AIFS is current. Edge function folder retains old name for infrastructure continuity.

## New Functions / Scripts
- `supabase/functions/mcp-server/index.ts` -- MCP server (1,045 lines). JSON-RPC 2.0, 5 tools, tier-gated responses, CORS, proper error codes.
- `src/components/agent/AIMaxPlan.tsx` -- AI Maximization Plan dashboard component (~460 lines). Pulls geo_audit_results via run_sql, renders personalized gap analysis.
- `docs/ai-maximization-plan-deeanna-penna.md` -- Sample AI Max Plan (Fragmented agent)
- `docs/ai-maximization-plan-anthony-alonzo.md` -- Sample AI Max Plan (Recognized agent)

## Deprecated or Removed
- Removed dead `agent-details` resource from mcp.json (/api/v1/agents/{id} endpoint never existed)
- state_licenses JOIN in MCP server replaced with direct professionals.license_number query (state_licenses.professional_id has 0 populated rows)
