# Cursor Daily Updates

Session takeaways and knowledge inserts.

---

## 2026-03-03

### Brand Builder deprecated
- **`is_brand_builder`** is deprecated for city/neighborhood listing logic.
- City pages now show **all** qualified agents (no round-robin, no brand-builder prioritization).
- Removed brand-builder score boost from `canonicalAgentService.ts`.
- The `is_brand_builder` column may still exist in DB and other flows (AccountSetup, ProfileView, etc.) but is no longer used for agent listing or ranking.

### City and neighborhood pages: list all agents
- City pages: show all qualified agents by tier (underwritten → audited → certified → listed).
- Neighborhood pages: already show all agents from `useAreaAgents` (no limit).
- No top-10 cap; full list displayed.
