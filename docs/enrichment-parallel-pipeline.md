# Enrichment Pipeline Parallelization

## Robert's Decisions (2026-03-20)

### API Keys
- **Serper**: Up to 10 keys available
- **Exa**: Up to 10 keys available
- **Memo23 (Apify)**: Unsure of rate limits — need to check
- **DeepSeek**: 1 key sufficient (cheap and fast)

### Budget Caps
- **Serper**: $500 max per run
- **Exa**: $500 max per run
- **Memo23**: $500 max per run
- **Total enrichment budget**: $500 (all caps but total set at $500)

### Execution Decisions
- **Run location**: Edge functions for Serper/Exa prequalification (high volume, simple calls), local workstation for Memo23 (slower, needs retry logic) — accepted recommendation
- **State ordering**: CA first (already running), then TX, FL, NY, CO — Robert needs to track down all licenses
- **Batch size**: 500 per worker — accepted
- **Concurrency**: Memo23 = 3 workers max. Serper/Exa = 10 workers each.

---

## Architecture

### Pattern
State-machine-in-the-database. Same pattern as email sequencer. All coordination in Supabase. No external queue, no Redis, no message broker.

### Two Phases
1. **Phase 1 (prequalify)**: Serper + Exa on every license. $0.003/each. ~2.5M volume.
2. **Phase 2 (deep)**: Memo23 + DeepSeek on ~2% that prequalify. ~50K volume.

### Table: `enrichment_jobs`
Coordinates all work. Workers claim rows atomically via `FOR UPDATE SKIP LOCKED`.

### Edge Function: `enrichment-worker`
One function handles all services. `service` param determines which API to call.

### Orchestration: `scripts/run-enrichment-parallel.ts`
Seeds jobs, spawns workers, monitors progress, enforces budget caps.

### Guardrails
- Budget cap per worker (stops claiming when exceeded)
- Rate limiting per worker (sleep between calls)
- No duplicate processing (SKIP LOCKED)
- Crash recovery (stale claim cron resets after 15 min)
- Idempotent (re-running is no-op on completed jobs)

---

## Status
- [ ] Migration SQL for enrichment_jobs + enrichment_progress view
- [ ] Edge function enrichment-worker/index.ts
- [ ] Orchestration script run-enrichment-parallel.ts
- [ ] Stale claim recovery cron
- [ ] API keys provisioned and stored as Supabase secrets
- [ ] State license data loaded for TX, FL, NY, CO
