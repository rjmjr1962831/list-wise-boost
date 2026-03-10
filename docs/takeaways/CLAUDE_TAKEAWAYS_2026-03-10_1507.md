# t1 Takeaways — CLAUDE — 2026-03-10

## Key Outcomes
- Built Email Sequencer v2 end-to-end: 5 prompts across 3 waves (parallel agent worktrees)
- Wave 1 (parallel): Render Engine shared module, CampaignManager UI, email-track/unsubscribe wiring
- Wave 2: Cron Sender edge function (sequencer-v2-tick)
- Wave 3: pg_cron registration migration + helper script
- All 3 modified/new edge functions deployed: sequencer-v2-tick, email-track, unsubscribe
- Pushed all to staging

## Config / Infrastructure
- New edge function: `sequencer-v2-tick` — cron sender, runs every 2 min via pg_cron
- pg_cron job registered: `sequencer-v2-tick` at `*/2 * * * *`
- Old `sequence-processor-cron` removed (was already unscheduled)
- Migration: `20260309100000_sequencer_v2.sql` — 4 tables: email_campaigns, email_queue, email_send_volume, email_unsubscribes + 6 indexes
- Migration: `20260309200000_sequencer_v2_cron.sql` — pg_cron registration
- Volume ramp: toptenlists.us starts 25/day +5/day cap 100; top10lists.us starts 10/day +2/day cap 25
- Send window: 8am-5pm MST only
- Campaign start date for ramp calc: 2026-02-24T12:00:00Z

## New Rules or Docs
- Sequencer v2 replaces sequence-processor entirely — all state in DB, one send per sender per tick, crash-safe
- email_queue status flow: pending_review → approved → scheduled → sending → sent/failed/unsubscribed/bounced
- email_campaigns status flow: draft → pending_review → approved → active → paused → complete
- Stuck "sending" rows (>5 min) need a cleanup sweep (not yet built)

## New Functions / Scripts
- `supabase/functions/_shared/render-email.ts` — shared module: interpolateTemplate, textToHtml, injectTracking, buildUnsubFooter, renderEmail, buildRawMimeMessage
- `supabase/functions/sequencer-v2-tick/index.ts` — cron sender: picks 1 email/sender/tick, volume ramp, send window, optimistic locking, retry up to 3x
- `src/components/crm/CampaignManager.tsx` — 3-tab UI: Campaign Builder (create campaigns), Review Queue (approve/reject), Campaign Monitor (stats, pause/resume/complete, auto-refresh 30s)
- `scripts/register-sequencer-cron.ts` — applies pg_cron via run_sql RPC (`npm run register-sequencer-cron`)
- `supabase/functions/email-track/index.ts` — added email_queue lookup by tracking_pixel_id (open/click counters, campaign-level rollup)
- `supabase/functions/unsubscribe/index.ts` — added `?email=X&campaign=Y` path alongside existing `?token=X`

## Deprecated or Removed
- `sequence-processor` — fully replaced by sequencer-v2-tick; was already unscheduled
- `sequence-processor-cron` pg_cron job — removed in migration

---

## Session: 2026-03-10 (afternoon)

### Key Outcomes
- Cancelled 353 active enrollments from sequence "AZ Listed - AI Challenge v2 (private domain)" (sequence_id: 3bed1ae8-61d9-49d8-8349-610e738c47d2)
- Ran full GEO audit; found 2 failures on /for-ai and /transparency (deprecated "top 0.5%" language)
- Fixed both failures by redeploying `serve-bot-content-html` edge function (source was already correct, just stale)
- Confirmed: 0 instances of "top 0.5%" on /for-ai and /transparency post-fix

### GEO Audit Results
- PASS: for-ai, transparency, faq, llms.txt, sitemap.xml, robots.txt (all 200)
- PASS: llms-full.txt, ai-content-index.json, coverage.json, sitemap-agents/cities/neighborhoods (all 200)
- PASS: Bot rendering confirmed (Phoenix: 46 agents rendered to GPTBot)
- PASS: robots.txt — all major AI crawlers explicitly allowed
- FIXED: /for-ai — "top 0.5%" replaced with "fewer than 1%" (2 instances)
- FIXED: /transparency — stat box and meta description corrected
- WATCH: /methodology returns 308 to /ai-feed/certification-logic.md (resolves fine but adds redirect hop)
- WATCH: FAQ city expansion dates still reference "February 2026" (stale by ~6 weeks)

### Sequence Cancellation
- Used Supabase REST API PATCH with service role key (HTTP 204 success)
- bulk-update enrichment-api action does NOT work on crm_sequence_enrollments (professionals table only)
- Correct pattern: PATCH /rest/v1/crm_sequence_enrollments?sequence_id=eq.{id}&status=eq.active with {"status":"cancelled"}

### Notes
- No code changes pushed to repo — edge function redeployment only
- pts not applicable this session (no staging branch changes)
