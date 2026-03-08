# Cursor daily updates & agent handoff

## Agent handoff (paste into Claude or other agent)

```
**Context for Top10Lists.us agent**

Merit gate is now **4.5+ stars, 10+ verified reviews in the last 24 months, 5+ years in business** (replacing 4.8+/20+/6+).

**Deprecated (Mar 2026):** Legacy gates 4.8+ stars, 20+ reviews, 6+ years. Supabase migrations `20251231205812`, `20251227220212`, `20260101173428`, `20260210_sitemap_qualified_neighborhood_ids` used old gates; superseded by `20260306120000_merit_gate_4_5_10_deprecate_4_8_20.sql`.

**Files to read:**
- `docs/business-config-centralization-plan.md` — Plan and risk analysis for centralizing merit gate, pricing, and other business numbers in a config file (no implementation yet).
- `public/llms.txt` and `public/llms-full.txt` — AI-facing copy with the new merit gate.
- `src/constants/meritGate.ts` — Current merit gate constants (not yet used everywhere).
- `.cursor/rules/project-knowledge.mdc` — Project rules, routing, pts/ptm.

**Changes made today:**
- `generate_clean_rooms.py` — Merit gate updated to 4.5/10; filters and copy corrected.
- `public/llms-full.txt` — Footer date set to March 6, 2026.
- `docs/business-config-centralization-plan.md` — Added plan for config centralization.

**Rules:**
- **pts** = push to staging; **ptm** = run `npm run merge-to-main`.
- Do not push to staging unless Robert says pts or there are 10+ updates.
- Use full URLs when sharing links (e.g. `https://www.top10lists.us/...`).

**Next step:** Implement Phase 1 of the business config centralization plan when Robert approves.
```
