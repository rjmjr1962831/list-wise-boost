# t1 — Claude Code Takeaways

When Robert says **"t1"** or **"run t1"**:

1. **Summarize** what you did this session. Bullet points only — no full logs. Include only:
   - Architecture changes (new services, schema, migrations, endpoints)
   - New functions, scripts, or edge functions
   - Config changes (env vars, cron jobs, Supabase, Vercel)
   - New or updated rules/docs
   - Deprecated or removed code/patterns
   - Important decisions or pivots
   - New API keys or credentials (redact secrets; note what was added)

2. **Save** to a timestamped file:
   - **Path:** `docs/takeaways/CLAUDE_TAKEAWAYS_YYYY-MM-DD_HHMM.md`
   - **Date:** Today in YYYY-MM-DD format.
   - **HHMM:** Current UTC time (e.g., `1507` for 3:07 PM UTC). This prevents collisions when multiple Claude instances run t1 on the same day.
   - **Example:** `docs/takeaways/CLAUDE_TAKEAWAYS_2026-03-10_1507.md`
   - **Never overwrite** another instance's file. The UTC timestamp makes each file unique.

3. **Required structure:**

```markdown
# Claude Code Takeaways — YYYY-MM-DD

## Key Outcomes
- (What was done; what was decided.)

## Config / Infrastructure
- (Env vars, URLs, new services, schema, cron. Redact secrets.)

## New Rules or Docs
- (Rule changes, new prompts, doc updates.)

## New Functions / Scripts
- (Edge functions, scripts, API endpoints.)

## Deprecated or Removed
- (Things we stopped using.)
```

4. **Do not** update `docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md`. The **s1** step (`npm run s1`) gathers all takeaways and synthesizes them into Section 21 of COMPREHENSIVE.

5. **Location:** `docs/takeaways/` — this path is excluded from main (internal docs, staging only).

6. **After t1**, Robert will say **pts** = commit and push to staging:
   ```
   git add docs/takeaways/*.md
   git commit -m "t1 takeaways"
   git push origin staging
   ```
