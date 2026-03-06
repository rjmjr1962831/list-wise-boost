# Agent Bot Tracking & Notification System

## Overview

This system tracks when AI bots (Google, Claude, ChatGPT, Perplexity, etc.) visit agent profiles and certification artifacts, then sends personalized email notifications to agents.

**Architecture (Cloudflare deprecated):** Log ingestion uses **our own pipeline** only. Call **`log-bot-visit`** from your front-end, middleware, or log pipeline with each request (url, user_agent, etc.), or bulk-load from your log files with **`scripts/ingest-request-logs.ts`**. The former Cloudflare logpull/logpush path is deprecated; the table name `cloudflare_request_logs` is legacy.

## Features

### 1. **Bot Visit Tracking**
- Automatically detects and logs bot visits and counts them per agent when the agent is visible on the page.
- **Full profile:** `/{state}/{city}/agents/{slug}` or **artifact:** `/artifact/{uuid}` → one row with that agent’s `agent_id`.
- **City list** (e.g. Phoenix): `/{state}/{city}` or `/{state}/{city}/top10realestateagents` → one **request** row with `agents_shown` (up to 50 agents); a **batch job** creates per-agent rows so each gets credit.
- **Neighborhood list** (e.g. Arcadia): same — one request row, batch job creates up to 50 per-agent rows.
- Tracks profile pages, artifact pages, and list pages (city/neighborhood).
- Records cache hit/miss status.

### 2. **Daily Summaries**
- Aggregates bot visits by date per agent
- Tracks unique bots, visit counts, page types
- Automatically updates via database trigger
- Optimized for fast querying

### 3. **Email Notifications**
- **Daily emails** sent at 9 AM UTC (customizable)
- Beautiful HTML emails with:
  - Total bot visits
  - Breakdown by bot type (Google, Claude, ChatGPT, etc.)
  - Recent activity timeline
  - Link to full dashboard
- Agents can toggle notifications on/off
- Future: Support for weekly or instant notifications

### 4. **Agent-Specific Dashboard**
- Located at `/agent/bot-analytics`
- Shows personalized bot analytics:
  - Total visits, unique bots
  - Profile vs artifact views
  - Cache hit rates
  - Recent bot activity
  - Bot type breakdown
- Toggle email notifications directly from dashboard

## Database Schema

### Tables Created

#### `agent_bot_notification_preferences`
- Stores agent notification settings
- Fields:
  - `agent_id` - References professionals table
  - `email_notifications_enabled` - Boolean toggle
  - `notification_frequency` - 'instant', 'daily', 'weekly', 'never'
  - `notify_for_bots` - Array of bot types to notify about
  - `last_notification_sent_at` - Timestamp tracking

#### `agent_bot_visit_summary`
- Daily aggregated statistics per agent (one row per agent per calendar day).
- **Retention**: Only the last **90 days** are kept. A daily cron job runs `purge_agent_bot_visit_summary_retention()` so the table size stays bounded (max rows ≈ agents with bot traffic × 90). For long-range or custom-period analytics, use `cloudflare_request_logs` (see [Scale and retention](#scale-and-retention)).
- Fields:
  - `agent_id`, `date` - Composite key
  - `total_bot_visits` - Count
  - `unique_bots` - Array of bot types
  - `visits_by_bot_type` - JSON object with counts
  - `profile_visits` / `artifact_visits` - Separate counters
  - `cache_hits` / `cache_misses` - Performance metrics

#### `cloudflare_request_logs` (modified)
- Added `agent_id` column
- Automatically populated when logging bot visits

### Scale and retention

**Why the summary table could grow too large**

- One row per (agent_id, date) means unbounded growth: e.g. 50k agents × 365 days ≈ 18M+ rows per year.
- The trigger runs on every bot log insert, so write load scales with traffic.

**What we do**

1. **Retention**  
   We keep only the last **90 days** in `agent_bot_visit_summary`. A daily cron job (`purge-agent-bot-summary-retention`) deletes older rows. Notifications and the agent dashboard only need recent data.

2. **Long-range or custom periods**  
   Use `cloudflare_request_logs` (filter `is_bot = true`, `agent_id IS NOT NULL`) and group by `agent_id` and your time bucket. See `scripts/bot-crawls-per-agent.sql` for ready-to-run queries.

**Optional future improvement**

- **Batch aggregation**: Instead of updating the summary in a trigger on every insert, run a nightly job that aggregates yesterday’s rows from `cloudflare_request_logs` into `agent_bot_visit_summary`. That reduces trigger load; the summary would be at most one day behind.

### List-page attribution and scale (up to 50 agents per page)

List pages (city and neighborhood) can show **up to 50 agents**. To keep the request path fast at ~1000+ requests/day:

- **On each list-page request:** We insert **one row** with `agents_shown` (array of up to 50 `{ canonical_slug, name }`), `agent_id` null, and `list_page_processed_at` null.
- **Batch job:** **`process-list-page-logs`** runs every **10 minutes** (cron). It reads unprocessed list-page rows, looks up professional ids for each slug, inserts one row per agent into `cloudflare_request_logs` (trigger updates `agent_bot_visit_summary`), then sets `list_page_processed_at` on the original row.
- **Result:** No 50-insert burst on the request path; per-agent attribution happens within ~10 minutes.

## Ingesting logs without Cloudflare

You can feed the same pipeline from **your own logs** (Vercel, server, or any export). No Cloudflare required.

**Script: `scripts/ingest-request-logs.ts`**

- Reads a **JSON Lines** (`.jsonl`) or **JSON array** file.
- Each line/entry: `path` or `url`, `user_agent`, optional `timestamp`, `cache_status`, `ray_id`, etc.
- Detects bot from `user_agent`, resolves `agent_id` from path (artifact UUID or `/{state}/agents/{slug}`), inserts into `cloudflare_request_logs`. The existing DB trigger still updates `agent_bot_visit_summary`.

```bash
npx tsx scripts/ingest-request-logs.ts path/to/logs.jsonl
```

Example log line:

```json
{"path":"/arizona/phoenix/agents/jane-doe","user_agent":"Mozilla/5.0 (compatible; Googlebot/2.1)","timestamp":"2026-03-06T12:00:00Z"}
```

If your log format differs (e.g. CSV or different field names), transform to this shape first or extend the script.

## Supabase Functions

### `log-bot-visit`
**Location**: `supabase/functions/log-bot-visit/index.ts`

**Ingestion entrypoint (no Cloudflare).** Accepts POST with `url`, `path`, `user_agent`, optional `timestamp`, `cache_status`, etc. Inserts one row into `cloudflare_request_logs`. For profile/artifact URLs sets `agent_id`; for list pages (city/neighborhood) sets `agents_shown` (up to 50 agents). Per-agent rows for list pages are created by the batch job, not on the request path.

### `process-list-page-logs`
**Location**: `supabase/functions/process-list-page-logs/index.ts`

**Batch job.** Runs every 10 min (cron). Selects rows where `agents_shown` is set and `list_page_processed_at` is null, looks up professional ids for each slug, inserts one row per agent (trigger updates summary), then sets `list_page_processed_at`. Keeps list-page attribution off the hot path.

### `send-bot-notifications`
**Location**: `supabase/functions/send-bot-notifications/index.ts`

Sends email notifications to agents:
- Queries agents based on notification preferences
- Aggregates bot visit data for the period
- Sends HTML emails via Resend API
- Updates last_notification_sent_at timestamp

**Usage**:
```bash
# Send daily notifications
curl -X POST https://...supabase.co/functions/v1/send-bot-notifications \
  -H "Authorization: Bearer {token}" \
  -d '{"frequency": "daily"}'

# Send to specific agent
curl -X POST https://...supabase.co/functions/v1/send-bot-notifications \
  -H "Authorization: Bearer {token}" \
  -d '{"agent_id": "uuid", "frequency": "daily"}'
```

## Frontend Components

### `AgentBotAnalyticsDashboard.tsx`
**Location**: `src/pages/AgentBotAnalyticsDashboard.tsx`
**Route**: `/agent/bot-analytics`

Features:
- Summary cards (visits, unique bots, page types, cache rate)
- Date range selector (24h, 7d, 30d)
- Notification toggle button
- Two tabs:
  - **Bot Breakdown**: Table of visits by bot type
  - **Recent Activity**: Timeline of recent bot visits

## Cron Jobs

### Daily Notification Job
**Schedule**: Every day at 9:00 AM UTC  
**Job name**: `send-daily-bot-notifications`

### Summary retention purge
**Schedule**: Every day at 3:00 AM UTC  
**Job name**: `purge-agent-bot-summary-retention`  
**Function**: `purge_agent_bot_visit_summary_retention()` — deletes `agent_bot_visit_summary` rows where `date < CURRENT_DATE - 90`. Keeps the summary table bounded (see [Scale and retention](#scale-and-retention)).

### List-page per-agent rows
**Schedule**: Every 10 minutes  
**Job name**: `process-list-page-logs`  
**Function**: `process-list-page-logs` Edge Function — creates per-agent rows from list-page rows (up to 50 agents per page) so the trigger can update `agent_bot_visit_summary` without doing 50 inserts on the request path.

## Deployment Steps

1. **Apply Database Migrations**:
```bash
# In Supabase SQL Editor, run:
c:\Repository\list-wise-boost\supabase\migrations\20260209_agent_bot_notifications.sql
c:\Repository\list-wise-boost\supabase\migrations\20260209_bot_notifications_cron.sql
```

2. **Deploy Supabase Functions**:
```bash
npx supabase functions deploy log-bot-visit --project-ref wiotrvoirdgzfacuuiem
npx supabase functions deploy send-bot-notifications --project-ref wiotrvoirdgzfacuuiem
```

3. **Deploy Worker** (already done):
```powershell
.\scripts\deploy-worker.ps1
```

4. **Set Environment Variables**:
Ensure `RESEND_API_KEY` is set in Supabase:
```bash
npx supabase secrets set RESEND_API_KEY=re_...
```

## Testing

### Test Bot Tracking:
```bash
# Send test bot request
curl "https://www.top10lists.us/california/agents/test-agent-1234" \
  -H "User-Agent: Mozilla/5.0 (compatible; Googlebot/2.1)"

# Check if agent_id was extracted
curl "https://wiotrvoirdgzfacuuiem.supabase.co/rest/v1/cloudflare_request_logs?select=*&is_bot=eq.true&limit=5" \
  -H "apikey: {key}"
```

### Test Email Notifications:
```bash
# Trigger notification for specific agent
curl -X POST "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/send-bot-notifications" \
  -H "Authorization: Bearer {service_role_key}" \
  -d '{"agent_id": "uuid", "frequency": "daily"}'
```

### Test Dashboard:
1. Log in as an agent
2. Visit `/agent/bot-analytics`
3. Verify stats are showing correctly
4. Toggle notifications on/off

## Future Enhancements

- [ ] Weekly summary emails
- [ ] Instant notifications for high-value bots (ChatGPT, Claude)
- [ ] SMS notifications option
- [ ] Comparison to other agents in market
- [ ] Bot visit trends over time (charts)
- [ ] Export bot analytics as CSV
- [ ] Webhook integrations
- [ ] Slack/Discord notifications

## Email Template Variables

Bot notification emails support:
- `agent.name` - Agent's name
- `totalVisits` - Number of visits
- `uniqueBots` - Array of bot types
- `visitsByBot` - Object with counts per bot
- `recentVisits` - Array of recent visit objects
- `dashboardUrl` - Link to dashboard

## Bot Types Tracked

- `googlebot` 🔍 - Google Search
- `claudebot` 🤖 - Claude AI
- `gptbot` 🧠 - ChatGPT
- `bingbot` 🔎 - Bing Search
- `perplexitybot` 💡 - Perplexity AI
- `unknown_bot` 🤔 - Unidentified bots

## Support & Troubleshooting

### Agents not receiving emails?
1. Check `agent_bot_notification_preferences` table
2. Verify `email_notifications_enabled = true`
3. Check `last_notification_sent_at` timestamp
4. View function logs: Supabase Dashboard → Edge Functions → Logs

### Dashboard not showing data?
1. Verify agent is logged in
2. Check `agent_id` is being extracted correctly in logs
3. Verify RLS policies allow agent to read their own data

### Bot visits not being tracked?
1. Check Cloudflare Worker is deployed with latest changes
2. Verify `log-bot-visit` function is deployed
3. Check function logs for errors
4. Verify bot detection patterns in worker code

## API Reference

### Get Agent Bot Summary
```sql
SELECT * FROM agent_bot_visit_summary
WHERE agent_id = 'uuid'
AND date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;
```

### Get Agent Notification Preferences
```sql
SELECT * FROM agent_bot_notification_preferences
WHERE agent_id = 'uuid';
```

### Update Notification Settings
```sql
UPDATE agent_bot_notification_preferences
SET email_notifications_enabled = true,
    notification_frequency = 'daily'
WHERE agent_id = 'uuid';
```
