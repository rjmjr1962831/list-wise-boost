# Prompt: Make RYT Use Only the Master Knowledge Document

Use this prompt with Claude (or another AI) to ensure the **ryt** function (only; takeaways is a different function) only reads and updates the master knowledge document.

---

**Copy from here:**

**Takeaways** is a different function (daily updates/learnings from each AI for the day). This prompt is only for **ryt**.

Modify the **ryt** function so it **only** reaches out to the master knowledge document. Do not read or write any other knowledge file (e.g. `TOP10LISTS-COMPLETE-KNOWLEDGE-UPDATED.md` or paths under `/mnt/project/` or `/mnt/user-data/outputs/`).

**Master knowledge document:**
- **Location:** In the repo, under the `docs` folder.
- **Path:** `docs/PROJECT-KNOWLEDGE.md`
- **Filename:** `PROJECT-KNOWLEDGE.md`

Update all instructions for **"ryt"** (not "takeaways") so that they:
1. Read the current content from `docs/PROJECT-KNOWLEDGE.md`.
2. Integrate session takeaways into that document.
3. Write the updated content back to `docs/PROJECT-KNOWLEDGE.md`.
4. Persist changes (e.g. commit and push to staging per project rules).

The single source of truth for project knowledge is **docs/PROJECT-KNOWLEDGE.md** only.

**If ryt is used in a Claude project (claude.ai):** Claude projects don’t get repo files automatically; `/mnt/project/` may be empty. Add **docs/PROJECT-KNOWLEDGE.md** as a project knowledge file in the Top10Lists Claude project settings so Claude can read it when the user says "ryt." Until then, the user can paste the file contents or upload the file in the chat.

**End of prompt.**
