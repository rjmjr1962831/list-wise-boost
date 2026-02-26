# Prompt: Make RYT Use Only the Master Baseline

Use this prompt with Claude (or another AI) to ensure the **ryt** function (only; takeaways is a different function) only reads and updates the master baseline document.

---

**Copy from here:**

**Takeaways** is a different function (daily updates/learnings from each AI for the day). This prompt is only for **ryt**.

Modify the **ryt** function so it **only** reaches out to the master baseline document. Do not read or write any other knowledge file (e.g. `MASTER_KNOWLEDGE_DOCUMENT_TODAY.MD`, `TOP10LISTS-COMPLETE-KNOWLEDGE-UPDATED.md`, or paths under `/mnt/project/` or `/mnt/user-data/outputs/`).

**Master baseline document (ryt target):**
- **Location:** Repo root.
- **Path:** `Top10Lists_MASTER_BASELINE.md`
- **Filename:** `Top10Lists_MASTER_BASELINE.md`

Update all instructions for **"ryt"** (not "takeaways") so that they:
1. Read the current content from `Top10Lists_MASTER_BASELINE.md`.
2. Integrate session takeaways into that document.
3. Write the updated content back to `Top10Lists_MASTER_BASELINE.md`.
4. Persist changes (e.g. commit and push to staging per project rules).

The single source of truth for the ryt function is **Top10Lists_MASTER_BASELINE.md** (repo root) only.

**If ryt is used in a Claude project (claude.ai):** Claude projects don’t get repo files automatically; `/mnt/project/` may be empty. Add **Top10Lists_MASTER_BASELINE.md** as a project knowledge file in the Top10Lists Claude project settings so Claude can read it when the user says "ryt." Until then, the user can paste the file contents or upload the file in the chat.

**End of prompt.**
