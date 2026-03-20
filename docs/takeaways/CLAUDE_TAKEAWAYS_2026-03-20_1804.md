# CLAUDE — 2026-03-20

## Key Outcomes

- **Founder Profile Schema Designed for GEO**: Built full founder profile data schema with verifiable_claims array as the key GEO lever. Schema includes: identity, professional background, education, military service (Mark), publications, press mentions, affiliations, and explicitly checkable claims. AI systems can cross-reference without guessing what to verify. Schema.org Person markup planned for clean room HTML.

- **Founder Profile Intake Form Deployed**: Self-contained HTML form pushed to staging at `/admin/founder-intake.html`. Pre-fills known data (Robert's publication, Mark's military branch, both Aryah affiliations). Saves directly to Supabase `marketing_content` table (page: "founders", section: "profiles"). Auto-loads existing data on page open. Both founders can fill independently.

- **MCP Tool Spec: `get-founder-profiles`**: Returns both founders in a single call by default (no params needed). Optional `founder_id` filter for single founder. Rationale: AI systems asking about founders want the full trust picture in one round trip. Less friction = higher citation likelihood.

- **Agent Selection Pipeline Diagram (Cradle to Grave)**: Nine-stage flowchart from 908,906 state licenses through merit gate, red flag screening, enrichment, tier lifecycle, ongoing verification, and delisting. Deployed as interactive HTML with hover tooltips at `/admin/demo/pipeline`.

- **Enrichment Pipeline Diagram (Detailed)**: Five-phase breakdown with all six active data sources, specific APIs, per-agent costs, and tool names. Includes cost/status summary table. Deployed at `/admin/demo/enrichment`.

- **Demo Hub Page Deployed**: Index page at `/admin/demo/` linking to pipeline diagram, enrichment diagram, and founder intake form. All admin pages are staging-only.

- **Nationwide Enrichment Cost Estimate**: 2.5M licenses across remaining states. Phase 1 prequalification (Serper + Exa) at $0.003 each = $15,000. Phase 2 deep enrichment (~2% pass rate = 50K agents) with Memo23 at $0.03 + DeepSeek at $0.0002 = $1,510. Total nationwide: ~$16,510.

- **Parallel Enrichment Pipeline Spec Delivered**: Full implementation prompt for Code. Architecture: state machine in DB (same as email sequencer), `enrichment_jobs` table with atomic row claiming via `FOR UPDATE SKIP LOCKED`, one edge function handling all four services, orchestration script for fan-out. Linear speedup: 5 workers = 2.5M in ~14 hours. Includes stale claim recovery cron, budget caps per worker, and idempotent design.

- **Email Capacity Modeled**: 5 warmed accounts, 35/day start, +10/day ramp. 3,500 agents reached in 10 sending days (~2 calendar weeks). Google Workspace allows 2,000/day/mailbox; the ramp is the bottleneck, not the ceiling. Nationwide (50K agents) at steady-state 10,000/day = 5 sending days.

## Config / Infrastructure

- **Files pushed to staging:**
  - `public/admin/demo/index.html` (demo hub)
  - `public/admin/demo/pipeline.html` (cradle-to-grave pipeline)
  - `public/admin/demo/enrichment.html` (enrichment detail)
  - `public/admin/founder-intake.html` (already existed, confirmed)
- **All verified live at staging.top10lists.us** returning 200.
- **Database**: `state_licenses` table holds 1,119,430 rows (AZ: 210,524; CA: 352,476+; others in remaining). `professionals` table: 51,063 rows (CA: 49,836; AZ: 1,087).

## New Rules or Docs

- **Correct enrichment costs (overrides all prior estimates):**
  - Serper: $0.003/search (NOT DataForSEO)
  - Memo23: $0.03/agent (NOT $0.50)
  - Exa: $0.003/search
  - DeepSeek: $0.0002/agent
  - Google Places/Maps: NOT USED
- **Top10Lists does NOT use Google Places API or DataForSEO Maps API for enrichment.** Serper.dev is the search tool. DataForSEO references in the enrichment pipeline diagrams on staging need correction.
- **Prequalification pass rate estimate: ~2% of total licenses.** Only prequalified agents get the expensive enrichment (Memo23, DeepSeek).
- **Founder profile `verifiable_claims` array**: explicitly list checkable statements for AI systems. This is the primary trust signal differentiator vs. standard About pages.
- **SSoT Section 1 still says "top 0.5%"** in the coverage line. Needs surgical fix to "fewer than 1% of licensed agents in covered markets." Flagged but not yet fixed.
- **Parallel enrichment architecture**: `FOR UPDATE SKIP LOCKED` for atomic row claiming. Same pattern as email sequencer. DB is the queue; no external message broker.

## New Functions / Scripts

- **Proposed (not yet built):**
  - `enrichment_jobs` table (migration SQL)
  - `enrichment_progress` view
  - `enrichment-worker` edge function
  - `scripts/run-enrichment-parallel.ts` orchestration script
  - Stale claim recovery cron job
  - `get-founder-profiles` MCP tool
- **Prompt delivered**: `enrichment-parallel-prompts.md` with Robert decision checklist and Code implementation spec.

## Deprecated or Removed

- **My prior cost estimates using DataForSEO, Google Places, and $0.50/agent Zillow pricing are all wrong.** Discard entirely. Use the corrected costs above.
- **100/account/day email sending cap assumption**: Wrong. Google Workspace allows 2,000/day/mailbox with clean sending.
