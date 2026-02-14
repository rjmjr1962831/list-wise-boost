# Agent Notifications Queue

Asynchronous, non-blocking notification system for AI crawler Citation Alerts. Preserves ~100ms response times for bots while triggering real-time notifications.

## Architecture

```
Bot Request → top10-renderer (Producer)
                    │
                    │ ctx.waitUntil(NOTIFICATION_QUEUE.send(payload))
                    │ (returns response immediately)
                    ▼
            agent-notifications-queue
                    │
                    │ max_batch_size: 10, max_batch_timeout: 30s
                    ▼
        agent-notifier-consumer (Consumer)
                    │
                    │ POST → log-bot-visit Supabase function
                    ▼
            agent_bot_visit_summary / email notifications
```

## Setup

### 1. Create Queue + Consumer (no wrangler required)

Deploy the setup function, then invoke it:

```bash
npx supabase functions deploy setup-agent-notifications-queue --project-ref wiotrvoirdgzfacuuiem
curl -X POST "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/setup-agent-notifications-queue" \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY"
```

Uses existing Supabase secrets: `CLOUDFLARE_ACCOUNT_ID`, `CURSOR_API_KEY` (Cloudflare API token).
Token needs: **Workers Scripts Write**, **Queues Write**.
Runs on ARM64, no wrangler needed.

### 2. Producer (Main Worker)

**If using wrangler deploy:**
```bash
npx wrangler deploy
```

**If using Supabase deploy-worker.ps1:**
Add the queue binding in Cloudflare Dashboard:
- Workers → top10-renderer → Settings → Bindings
- Add Queue Producer: `agent-notifications-queue` → `NOTIFICATION_QUEUE`

### 3. Consumer

```bash
npx wrangler deploy -c wrangler.consumer.toml
```

Set auth for log-bot-visit:
```bash
npx wrangler secret put NOTIFICATION_AUTH_TOKEN -c wrangler.consumer.toml
# Value: Your Supabase anon key OR service role key (raw JWT, no "Bearer " prefix)
# The consumer sends: Authorization: Bearer <NOTIFICATION_AUTH_TOKEN>
```

### 4. Optional: Custom Endpoint

Override default log-bot-visit URL:
```bash
npx wrangler secret put NOTIFICATION_ENDPOINT -c wrangler.consumer.toml
# Value: https://your-api.com/notify
```

## Payload

Producer sends:
```json
{
  "agent_id": "uuid|null",
  "agent_slug": "slug|null",
  "bot_name": "googlebot|claudebot|gptbot|...",
  "timestamp": "2026-02-10T...",
  "request_url": "https://...",
  "user_agent": "..."
}
```

Consumer forwards to log-bot-visit:
```json
{
  "url": "https://...",
  "path": "/arizona/agents/john-doe-1234",
  "bot_type": "googlebot",
  "timestamp": "...",
  "user_agent": "...",
  "method": "GET"
}
```

## Guaranteed Delivery

- `message.ack()` on successful POST
- `message.retry()` on failed API call
- Cloudflare Queues retries with exponential backoff

## Batching

- `max_batch_size: 10` — process up to 10 messages per invocation
- `max_batch_timeout: 30` — flush after 30s even if batch incomplete

## Verification Checklist

### 1. Test log-bot-visit endpoint directly

```powershell
# Replace YOUR_ANON_KEY with your Supabase anon key (Project Settings → API)
$headers = @{
  "Authorization" = "Bearer YOUR_ANON_KEY"
  "Content-Type" = "application/json"
}
$body = @{
  url = "https://www.top10lists.us/arizona/phoenix/top10realestateagents"
  path = "/arizona/phoenix/top10realestateagents"
  bot_type = "gptbot"
  timestamp = (Get-Date -Format "o")
  user_agent = "GPTBot/1.0"
  method = "GET"
} | ConvertTo-Json
Invoke-RestMethod -Uri "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/log-bot-visit" -Method POST -Headers $headers -Body $body
```

Expected: `{ "success": true }`. If 401, the key is wrong. If 400, check payload.

### 2. Verify consumer has NOTIFICATION_AUTH_TOKEN

Cloudflare Dashboard → Workers & Pages → agent-notifier-consumer → Settings → Variables and Secrets.
NOTIFICATION_AUTH_TOKEN must be set (raw Supabase anon or service_role key).

### 3. Verify producer has NOTIFICATION_QUEUE binding

Cloudflare Dashboard → Workers & Pages → top10-renderer → Settings → Bindings.
Queue Producer: agent-notifications-queue → NOTIFICATION_QUEUE.

### 4. End-to-end test

Request a page with a bot user-agent:
```powershell
curl -H "User-Agent: Mozilla/5.0 GPTBot/1.0" "https://www.top10lists.us/arizona/phoenix/top10realestateagents"
```

Then check `cloudflare_request_logs` in Supabase (or your agent notification pipeline) for the new row.
