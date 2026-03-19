# Claude Code Takeaways -- 2026-03-19

## Key Outcomes
- **MCP request logging shipped end-to-end**: new table, view, MCP server instrumentation, bot analytics dashboard card/tab, crawl-stats Section F -- all deployed and verified
- **MCP payloads tier-gated**: Listed gets 7 fields (name/city/state only), Certified gets 20 (license, reviews, AIFS), Audited gets 28 (sales data, socials, platforms), Underwritten gets 35 (AIFS breakdown, gap analysis, contact, crypto). Previously Listed and Certified were identical -- no value differentiation
- **Link header for MCP discovery**: every HTTP response from top10lists.us now includes `Link: </.well-known/mcp.json>; rel="mcp-server"` for AI agent discovery
- **Transaction gate analysis**: at 100 minimum verified transactions, 872 agents (26.6%) would be disqualified; at 50, 309 (9.4%). Transaction data is all-side (buy+sell combined from Zillow), not sell-side only. 248 agents have team stats included. Median is 196 transactions.
- **Gemini merit gate hallucination**: Gemini still cites 4.8+ stars despite all live pages serving correct 4.5+. Confirmed /transparency, /methodology, /about/ranking-methodology all clean. Issue is Gemini's parametric memory, not our content.

## Config / Infrastructure
- **`mcp_request_logs` table** created in Supabase: id (uuid), tool_name, agent_id (nullable), city, state, request_params (jsonb), user_agent, ip, created_at. Indexes on created_at and tool_name. RLS enabled with service_role_all policy.
- **`mcp_request_stats` view** created: aggregates by tool_name with total_calls, distinct_agents, distinct_cities, last_seen. 30-day rolling window.
- **`run_sql` does not support INSERT/UPDATE/DELETE** -- only SELECT. MCP logging uses `supabase.from().insert()` instead. Important for any future logging patterns.
- **Fire-and-forget doesn't work in Deno Deploy** -- isolate terminates before background promises complete. MCP logging uses `await` inside try/catch instead.
- **Link header** added to vercel.json: `Link: <https://www.top10lists.us/.well-known/mcp.json>; rel="mcp-server"; type="application/json"` on all responses

## New Rules or Docs
- **MCP payload tier gating is now enforced**: Listed agents get bare minimum (name, city, profile_url). Each upgrade_note tells AI what data the next tier unlocks. This is the core value proposition -- AI systems get richer data for higher-tier agents, making them more citable.
- **Evaluated AI-generated MCP discovery advice**: X-MCP-Server in robots.txt (fake standard), WebMCP/navigator.modelContext (hallucinated), "crawlers check mcp.json first" (unsubstantiated). Link header is the only real addition worth implementing.

## New Functions / Scripts
- **MCP server logging block** (~15 lines): inserts to mcp_request_logs after each tool call via supabase client .insert(). Catches errors silently.
- **Bot Analytics Dashboard MCP tab**: new "MCP Tool Calls" summary card (5th card in grid) + dedicated tab showing per-tool breakdown with call counts, distinct cities, last called timestamp
- **crawl-stats Section F**: "Direct AI Tool Calls (MCP)" with tool breakdown table, top cities queried table, MCP Tool Calls added to JSON-LD variableMeasured

## Deprecated or Removed
- **Identical Listed/Certified MCP payloads** -- Listed no longer gets license, reviews, AIFS, or verification dates. Those are now Certified+ only.
- **Placeholder strings in MCP payloads** ("Available for Audited and Underwritten tiers") replaced with actual data gating -- fields simply don't exist in lower tiers rather than showing teaser text
