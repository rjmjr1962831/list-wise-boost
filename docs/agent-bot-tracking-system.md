# Agent Bot Tracking & Notification System

## Overview

This system tracks when AI bots (Google, Claude, ChatGPT, Perplexity, etc.) visit agent profiles and certification artifacts, then sends personalized email notifications to agents.

## Features

### 1. **Bot Visit Tracking**
- Automatically detects and logs bot visits to agent profiles
- Extracts `agent_id` from URL paths:
  - `/california/agents/john-doe-1234` → looks up by canonical_slug
  - `/artifact/{uuid}` → directly extracts UUID
- Tracks both profile pages and artifact pages
- Records cache hit/miss status

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
- Daily aggregated statistics per agent
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

## Supabase Functions

### `log-bot-visit` (modified)
**Location**: `supabase/functions/log-bot-visit/index.ts`

Enhanced to extract agent_id from URLs:
- Pattern 1: `/artifact/{uuid}` - direct extraction
- Pattern 2: `/{state}/agents/{slug}` - database lookup

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

```sql
SELECT cron.schedule(
  'send-daily-bot-notifications',
  '0 9 * * *',
  $$ ... $$
);
```

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
