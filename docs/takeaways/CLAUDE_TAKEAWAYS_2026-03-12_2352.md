# Claude Code Takeaways — 2026-03-12

## Key Outcomes

### Clean-Room JSON-LD Schema Enrichment (GEO)
- Enriched `serve-bot-agent-html` JSON-LD: replaced plain `identifier` with structured `hasCredential` (`EducationalOccupationalCredential`), expanded `sameAs` to include license registry + social + Zillow, added `subjectOf` evidence citations (tier-gated matching HTML footnotes), enriched `description` with Merit Gate context for all tiers
- Added `Dataset` JSON-LD to `serve-bot-list-html` for neighborhood market stats (median income, tier, spatial coverage with ZIP, Census Bureau citation) — AI systems now see structured data instead of "a table on a webpage"
- Upgraded ItemList items in `serve-bot-list-html` with `hasCredential` and `sameAs` to state license registry (replacing plain `identifier` string)
- Verified live on production: North Phoenix neighborhood page shows Dataset schema, agent profiles show full enriched JSON-LD

### Certified Tier Reactivation
- Reactivated Certified tier as active (was legacy/grandfathered-only since 2026-03-03): free, quarterly refresh, open to all qualified agents
- Updated refresh cadence from monthly to quarterly across all edge functions (`serve-bot-agent-html`, `serve-bot-list-html`)
- Re-added `"certified"` to `validTiers` in `funnel-select-tier` edge function, updated `isFree` check
- Added Certified card to `Step7Pricing.tsx`: free option with quarterly refresh, 4 evidence sources, badge + artifact, 3-column grid layout
- Updated DB: `certification_pricing_config` certified row `refresh_cadence` set to `"quarterly"`
- Eliminated all "legacy", "grandfathered", "~58", "no longer offered", "no new issuances" language across entire codebase

### GEO Audit
- Production audit: 3,290 pages checked, 3,262 agents — all returning 200
- 36 "errors" are all false positives: health check regex flags legitimate "6+ years" in agent bios (agents who have exactly 6 years, which is above the 5+ gate)
- 20 warnings are cold-start latency (~4.2s on first batch), all subsequent requests fast (417ms p50)
- Zero structural issues, zero deprecated language (except the false positive above)

### Context Window Status Line
- Configured `~/.claude/statusline-command.sh` to monitor context usage in real-time
- Shows percentage normally; switches to bold red warning at 90%+ usage
- Added to `~/.claude/settings.json` as persistent status line

## Config / Infrastructure
- 3 edge functions deployed: `serve-bot-agent-html`, `serve-bot-list-html`, `funnel-select-tier`
- DB `certification_pricing_config` certified row: `refresh_cadence` = `"quarterly"` (was `"monthly"`)
- `~/.claude/settings.json`: added `statusLine` configuration
- `~/.claude/statusline-command.sh`: new script for context window monitoring

## New Rules or Docs
- Certified tier is now active for all qualified agents (not legacy-only)
- Certified refresh cadence: quarterly (not monthly or annual)
- Business model is 4-tier: Listed (free, annual), Certified (free, quarterly), Audited ($300/mo, monthly), Underwritten ($500/mo, daily)

## New Functions / Scripts
- `~/.claude/statusline-command.sh` — context window percentage monitor with 90% threshold alert

## Deprecated or Removed
- All "legacy", "grandfathered", "~58 agents", "no longer offered" language about Certified tier — removed from: llms.txt, llms-full.txt, mcp.json, ai-content-index.json, tier-certified.md, vetting-standards.md, faqFull.ts (4 entries), serve-bot-list-html upgrade hint
- Plain `identifier` string in clean-room JSON-LD — replaced by structured `hasCredential` with `EducationalOccupationalCredential`
