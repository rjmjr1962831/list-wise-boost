# Claude: Nightly Takeaways — Private Repo Only (Not Public)

Use this prompt (or add it to your Claude project instructions) so that when Robert says **"takeaways"** or **"run takeaways"**, Claude produces the daily takeaways and posts them in the **private** knowledge repo only. These documents must **not** be in the public repo or pushed to staging/main.

---

## Copy from here

**When Robert says "takeaways" or "run takeaways":**

1. **Generate** your daily takeaways in this exact format. Include only outcomes from your session(s) today—no full chats, deployment nitty-gritty, or brainstorming. Use short bullet points.

   **Required structure:**

   ```markdown
   # Daily Takeaways — YYYY-MM-DD

   ## Outcomes to Commit to Project Memory

   ### Key Outcomes
   - (What was done; what was decided.)

   ### Config / Infrastructure Changes
   - (Env vars, URLs, new services, schema, cron, etc.)

   ### Deprecated or New Patterns
   - (Things we stopped using or started using.)

   ### Version Bump Notes
   - (Releases, version numbers, dates.)
   ```

2. **Save** the content as a single file:
   - **Path:** `docs/takeaways/CLAUDE_TAKEAWAYS_DD-MM-YY.md`
   - **Date in filename:** Use today’s date as DD-MM-YY (e.g. 16-02-26 for 16 February 2026).
   - **Example:** For 16 February 2026, the file is `docs/takeaways/CLAUDE_TAKEAWAYS_16-02-26.md`.

3. **Where to put it (important):** Push this file **only** to the private knowledge repo:
   - **Repo:** `https://github.com/rjmjr1962831/top10lists-knowledge` (private; use the ai full access token for auth).
   - **Path in repo:** `docs/takeaways/CLAUDE_TAKEAWAYS_DD-MM-YY.md` (e.g. `docs/takeaways/CLAUDE_TAKEAWAYS_16-02-26.md` for 16 February 2026).
   **Do not** push these takeaways to the public repo `rjmjr1962831/list-wise-boost` or to staging/main. If you cannot push to the private repo, output the full file content and tell Robert to add it there.

4. **Do not** update `docs/PROJECT-KNOWLEDGE.md` yourself. Takeaways are merged into the master knowledge document by a separate nightly synthesis step; only the synthesized result may live in the public repo.

5. **Schedule:** When Robert (or your project) is set to run at **21:00 MST**, run this takeaways flow and post the file to the private repo so it exists by the time the nightly knowledge synthesis runs.

**End of prompt.**
