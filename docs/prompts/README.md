# Prompts for AI Assistants

## t1 (Takeaways — Per-AI, Key Findings)

**When Robert says "t1" or "run t1":** Generate key findings (no full chat sessions) and save to `docs/takeaways/{AI_ID}_TAKEAWAYS_YYYY-MM-DD.md`. Each AI creates its own file (CURSOR, CLAUDE, GEMINI, etc.).

- `t1-takeaways-prompt.md` — universal prompt for any AI (Cursor, Claude, Gemini, etc.)

**Master synthesis:** Run `npm run t1:synthesize` to gather all per-AI takeaways and update `docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md` (Section 21).

## Legacy Takeaways (Private Repo)

Claude and Gemini may also use the legacy prompts that push to the private knowledge repo `top10lists-knowledge`:

- `claude-takeaways-prompt.md` — copy into Claude project instructions
- `gemini-takeaways-prompt.md` — copy into Gemini project instructions
