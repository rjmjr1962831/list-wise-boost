# CLAUDE — 2026-03-21

## Key Outcomes

### GEO Audit Response (5 fixes from Claude Web audit)
- **C1 (Dead sitemap URLs):** Already clean — 17 URLs were removed in prior session. No action needed.
- **C3/H3 (Certified tier + FAQ contradictions):** Fixed across 14 files. Certified is active (4 tiers). "Invitation-only" replaced with merit-based selection language. Certified refresh corrected to "quarterly" everywhere. master-ssot.md updated to 4-tier model.
- **H1 (DB selection_rationale):** 12 records updated — "top 0.5%" replaced with "fewer than 1% of licensed agents in covered markets." Zero stale language remaining.
- **C2/M4 (stats.json):** New `serve-stats-json` edge function deployed. Returns live agent/city/neighborhood counts from DB with 1-hour cache. Vercel rewrite at `/stats.json`. Live counts: 3,262 agents (872 AZ + 2,390 CA), 1,738 cities, 10,144 neighborhoods.
- **GEO enhancements from ChatGPT report:** ItemList JSON-LD enhanced with `url`, `areaServed`, `itemListOrder` on city/neighborhood pages. Lead summary paragraph (`data-ai-summary="true"`) added. Dynamic `dateModified` from agent `updated_at`.

### Email Enrichment (206 agents, $0.93 Serper cost)
- **45 new emails found** via Serper for agents that had none (name-matched, high confidence).
- **22 corrected emails** for agents with wrong-person email assignments.
- **161 agents flagged** as `pending_email_verification` in `lead_status`.
- Ai Hui Wang → annaskogen@gmail.com confirmed correct (goes by Anna Wang, maiden name Skogen).
- Ai Quoc Pham → quanpham2090@gmail.com confirmed correct.

### Team Separation
- **34 teams identified** and flagged with `lead_status = 'team'`.
- **31 team leaders identified** (26 from Zillow `team_display_information`, 5 from Serper). Written to `headline` field as "Team Leader: {Name}".
- **"Exclude teams" checkbox** added to List Maker (default on). Wired through both client query paths and `list-maker-export` edge function.
- 3 unknown: Coldwell Banker First Affiliate, Guerrero Group, Mackey Real Estate Team.

### List Maker Upgrades
- **AI surfaces export fixed** — all 12 `ai_surfaces_*` fields now export via subqueries against `agent_ai_surfaces_by_bot`.
- **First Name / Last Name** — new split fields added to output.
- **`ai_surfaces_total` renamed to `ai_surfaces_total_7d`**.
- **Legacy AIFS section removed** from UI. `footprint_context` moved to AIFS Score Fields.
- **Create Email button** added inline on List Maker with merge variable copy-to-paste.

### Campaign Wizard Rewrite (7-step flow)
1. **Create or Select Campaign** — name or pick existing
2. **Build List** — full filter criteria + output field selectors (Agent Fields, AIFS Score Fields, AI Surfaces with select-all toggles). Selected fields become merge variables.
3. **Create Email** — subject line + TipTap WYSIWYG rich text editor (bold, italic, underline, links, lists, headings). Merge variables click-to-copy. Magic Link copies as `<a href="{{magic_link}}">here</a>`.
4. **Send Gates** — max emails/day per mailbox, daily uptick, min seconds between sends. Yesterday's stats shown. Capacity calculator with estimated days to send.
5. **Review** — email preview with sample data, proper paragraph spacing.
6. **Test** — send test emails to Robert's addresses.
7. **Launch** — draft, immediate, or scheduled.

- **Variable interpolation at queue time** — launch fetches all agent data via `list-maker-export` edge function (handles JOINs for AIFS, bot crawl, etc.), interpolates every `{{variable}}` per agent before queuing.
- **Scroll-to-top** on step changes.

### Email Infrastructure
- **RLS policies added** for `email_campaigns` and `email_queue` tables (both had RLS enabled with zero policies = everything blocked).
- **`sequencer-v2-tick` deployed** and pg_cron job created (every 2 minutes). Was not deployed and had no cron — emails were queuing but never sending.
- **`mark@toptenlists.us`** added as sender account.
- **TipTap rich text editor** installed (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-underline`).

### CRM / UI
- **CRM scroll-to-top** on page load and tab switch.
- **/crm blocked on production** via Vercel redirect to /404.
- **`lead_status` field** added to enrichment-api allowed fields (both bulk-update and single-update).

## Config / Infrastructure
- **Edge functions deployed:** serve-stats-json, serve-bot-list-html, list-maker-export, enrichment-api, sequencer-v2-tick.
- **Vercel rewrites added:** `/stats.json` → serve-stats-json, `/crm` → /404 on production.
- **pg_cron jobs:** `sequencer-v2-tick` every 2 minutes.
- **RLS policies:** email_campaigns (5 policies), email_queue (5 policies).
- **NPM packages added:** @tiptap/react, @tiptap/starter-kit, @tiptap/extension-link, @tiptap/extension-underline, @tiptap/pm.
- **Database updates:** 12 selection_rationale records, 45 new emails, 22 corrected emails, 161 pending_email_verification, 34 team flags, 31 team leader headlines.

## New Rules or Docs
- **DO NOT PUSH without Robert's express permission** — consolidated 3 redundant memory files into one. ALL dev on localhost.
- **Certified tier is ACTIVE** — 4 tiers: Listed/Certified/Audited/Underwritten. SSoT Section 3 was stale.
- **Agent selection model:** Merit-based selection by Top10Lists, not "invitation-only" and not "open signup."
- **`@tailwindcss/typography` plugin** is installed but NOT in tailwind.config.ts plugins. The `prose` class does nothing — use explicit child selectors like `[&_p]:mb-3` instead.

## Deprecated or Removed
- Legacy AIFS Fields section removed from List Maker UI.
- List Maker tab removed from Campaign Manager (List Maker is accessible from CRM sidebar).
- Old event-based Create Email flow (localStorage + CustomEvent) removed.
- All draft/active campaigns deleted (clean slate per Robert's request).
- 15,105 queued emails deleted.
