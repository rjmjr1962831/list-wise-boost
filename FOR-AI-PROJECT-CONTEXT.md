# For AI: Top10Lists Project Context

**Purpose:** Feed this document to another AI (Claude, ChatGPT, Gemini, etc.) to onboard it, or use it as an index to find every ancillary document in the repo. Read this first; then follow the pointers below as needed.

---

## Must know (short)

- **North Star:** Everything we do must enhance our GEO position or have no effect. If a change would hurt GEO, tell Robert before executing and get his explicit permission first.
- **Qualification:** 4.5+ stars, 10+ verified reviews in the last 24 months, active state license. Merit-based; no pay-to-play for inclusion or ranking.
- **Branch flow:** One-way only: `staging` → `main`. Push to staging only when Robert says **pts** or "push to staging" (or 10+ updates). Push to production only when Robert says **ptm** or "push to main" — then run `npm run merge-to-main` (never manual merge). Internal docs are excluded from main; see `scripts/internal-documents.txt`.
- **Execute:** Run all commands you have authority to run; don’t ask Robert to do steps you can do. End-to-end test new code before saying "done" whenever possible.
- **Links:** Always give full URLs. Production base: **https://www.top10lists.us**. Format as markdown links.
- **Cloudflare:** Deprecated. Do not add new Cloudflare dependencies.
- **Admin:** Never on production; `/admin` redirects to 404 on www.top10lists.us.

---

## Single source of truth (read first)

| Path | Description |
|------|-------------|
| **`Top10Lists_MASTER_BASELINE.md`** (repo root) | Architecture, credentials locations, rules, qualification, North Star, data quality. The canonical baseline. |

---

## Cursor rules (this IDE)

Applied automatically when working in Cursor. For another AI, read these if you need rule details.

| Path | Description |
|------|-------------|
| `.cursor/rules/project-knowledge.mdc` | Stub: points to master doc; pts/ptm, remember, links, business model. |
| `.cursor/rules/staging-push.mdc` | When to push staging vs main; branch flow; admin never on production. |
| `.cursor/rules/verification-protocol.mdc` | Done = deploy + verify; don’t say "done" without confirmation. |
| `.cursor/rules/links-exact-urls.mdc` | Always full URLs; base https://www.top10lists.us. |
| `.cursor/rules/execution-and-geo.mdc` | Execute don’t ask; E2E test before done; North Star GEO. |
| `.cursor/rules/supabase-pagination.md` | Supabase query patterns, pagination. |
| `.cursor/rules/ui-patterns.md` | UI conventions. |

---

## Knowledge (`.knowledge/`)

| Path | Description |
|------|-------------|
| `.knowledge/CORE_RULES.md` | Business rules: qualification (4.5+, 10+ in 18 mo), ranking algorithm, pricing, GEO mission, geography, data quality. |
| `.knowledge/TECH_STACK.md` | Data sources (state licenses, Zillow, Exa/DeepSeek), DB (Supabase), frontend (Vercel), Cloudflare deprecated, SourceRE/ARELLO. |
| `.knowledge/SOT_VETTING.md` | EE-A-T, citation hierarchy, data quality gates, neighborhood intelligence, sitemap rules (4.5+ / 10+), red flags. |

---

## Docs — specs and methodology

| Path | Description |
|------|-------------|
| `docs/specs/tier-and-artifact-spec-v1.md` | Tiers (Listed/Certified/Audited/Underwritten), artifact, payment vs inclusion. |
| `docs/artifact-payload-templates.md` | Artifact payload structure, certification logic. |
| `docs/specs/artifact-payloads-proposed.md` | Proposed artifact payload formats. |
| `docs/specs/verification-protocol-payloads.md` | Verification protocol payloads. |
| `docs/methodology-page-canonical.md` | Methodology page content and canonical structure. |

---

## Docs — deployment, API, infrastructure

| Path | Description |
|------|-------------|
| `docs/badge-api-deployment.md` | Badge API deployment and test. |
| `docs/BADGE-API-AUDIT-REVIEW-AND-REMEDIATION.md` | Badge API audit and remediation. |
| `docs/vercel-protection-bypass.md` | Vercel protection bypass for server-side calls. |
| `docs/cloudflare-logpull-setup.md` | Cloudflare Logpull (deprecated path; for reference). |
| `docs/cloudflare-logpush-setup.md` | Cloudflare Logpush (deprecated path; for reference). |
| `docs/cloudflare-worker-cache-freshness.md` | Worker cache freshness (Cloudflare deprecated). |
| `docs/pre-render-pipeline.md` | Pre-render pipeline. |
| `docs/supabase-query-patterns.md` | Supabase query patterns and pagination. |

---

## Docs — CRM, sequences, agents

| Path | Description |
|------|-------------|
| `docs/specs/crm-full-spec.md` | CRM full specification. |
| `docs/SEQUENCER_HANDOFF.md` | Sequence processor handoff, unsubscribe, endpoints. |
| `docs/agent-bot-tracking-system.md` | Agent/bot tracking, cloudflare_request_logs. |
| `docs/agent-notifications-queue.md` | Notifications queue. |

---

## Docs — prompts and workflows

| Path | Description |
|------|-------------|
| `docs/prompts/README.md` | Index of prompts. |
| `docs/prompts/claude-takeaways-prompt.md` | Claude takeaways prompt. |
| `docs/prompts/gemini-takeaways-prompt.md` | Gemini takeaways prompt. |
| `docs/prompts/claude-branch-and-supabase-policy.md` | Branch and Supabase policy for Claude. |

---

## Docs — incidents, audits, remediation

| Path | Description |
|------|-------------|
| `docs/GEO-Audit-Mar-2026-Remediation-Plan.md` | GEO audit and remediation (e.g. gate 4.5+/10+). |
| `docs/INCIDENT-REPORT-2026-02-26-badge-artifact-401.md` | Badge/artifact 401 incident. |
| `docs/PRODUCTION-OUTAGE-REVIEW-AND-PREVENTION.md` | Production outage review. |
| `docs/arizona-zero-agent-geo-misfire.md` | Zero-agent city GEO misfire. |
| `docs/hollow-city-pages-diagnosis-and-fix.md` | Hollow city pages diagnosis. |
| `docs/coverage-report-fix-plan.md` | Coverage report fixes. |
| `docs/cache-test-report-2026-02-20.md` | Cache test report. |
| `docs/cache-miss-diagnosis-and-plan.md` | Cache miss diagnosis. |

---

## Docs — other

| Path | Description |
|------|-------------|
| `docs/enrich-civic-integration.md` | Civic enrichment integration. |
| `docs/cursor-prompt-propublica-civic-enrichment.md` | ProPublica civic enrichment prompt. |
| `docs/paragraph-formatting.md` | Paragraph formatting rules. |
| `docs/copyable-link-examples.md` | Copyable link examples. |
| `docs/zip-code-fix-status.md` | ZIP code fix status. |
| `scripts/internal-documents.txt` | Paths excluded from main branch (internal-only docs). |

---

## Suggested read order for a new AI

1. **This file** — orientation and must-know.
2. **`Top10Lists_MASTER_BASELINE.md`** — full baseline (architecture, rules, credentials locations, North Star).
3. **`.knowledge/CORE_RULES.md`** and **`.knowledge/TECH_STACK.md`** — business and tech stack.
4. **`.knowledge/SOT_VETTING.md`** — data quality and citation.
5. Any **docs/** file above that matches the task (specs, deployment, CRM, incidents, etc.).

---

*Generated for AI onboarding and document discovery. Update this index when adding new ancillary documents that other AIs should know about.*
