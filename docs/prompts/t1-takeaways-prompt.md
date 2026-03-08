# t1 — Takeaways (Per-AI, Key Findings Only)

When Robert says **"t1"** or **"run t1"**:

1. **Generate** key findings from your session(s) since the last t1 run. **No full chat sessions.** Include only:
   - New API keys, env vars, or credentials (redact secrets; note what was added)
   - Architecture changes (new services, schema, migrations, endpoints)
   - New rules or rule updates (.cursor/rules, docs)
   - New functions, scripts, or edge functions
   - Deprecated patterns or removed code
   - Config changes (businessConfig, Supabase, Vercel)
   - Important decisions or pivots

2. **Do not read** other docs. Exception: **read the target takeaways file if it exists** so you can merge (see step 3). Robert will run **s1**, then have you run **ryt** to get the fresh knowledge.

3. **Save** to a file named by your AI identity:
   - **Path:** `docs/takeaways/{AI_ID}_TAKEAWAYS_YYYY-MM-DD.md`
   - **AI_ID:** Use your identifier: `CURSOR`, `CLAUDE`, `GEMINI`, etc.
   - **Date:** Today in YYYY-MM-DD format.
   - **Example:** Cursor saves `docs/takeaways/CURSOR_TAKEAWAYS_2026-03-08.md`
   - **Merge, do not overwrite:** If the file already exists (e.g., another Cursor session ran t1 today), read it, append your new bullets to the appropriate sections, and write the merged result. Preserve all existing content.

4. **Required structure:**

```markdown
# t1 Takeaways — {AI_ID} — YYYY-MM-DD

## Key Outcomes
- (What was done; what was decided. Bullet points only.)

## Config / Infrastructure
- (Env vars, URLs, new services, schema, cron. Redact secrets.)

## New Rules or Docs
- (Rule changes, new prompts, doc updates.)

## New Functions / Scripts
- (Edge functions, scripts, API endpoints.)

## Deprecated or Removed
- (Things we stopped using.)
```

5. **Do not** update `docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md` yourself. The **s1** step does that.

6. **Location:** Save in this repo at `docs/takeaways/`. This path is excluded from main (internal docs).

7. **pts:** When Robert says **"pts"** after t1, commit and push to staging: `git add docs/takeaways/*.md`, `git commit -m "t1 takeaways"`, `git push origin staging`.
