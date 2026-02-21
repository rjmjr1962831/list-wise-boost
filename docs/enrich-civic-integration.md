# Enrich-Civic (ProPublica) – Run & Supabase Integration

## One-shot: run batch from your machine

Replace `YOUR_ENRICHMENT_KEY` with your actual key (same value as enrichment-api). Run once per batch; each run processes up to 50 agents. Repeat until progress link shows no remaining.

**Arizona (max 50 per run):**
```bash
curl -s -X POST "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrich-civic" \
  -H "Content-Type: application/json" \
  -H "X-Enrichment-Key: YOUR_ENRICHMENT_KEY" \
  -d "{\"batch\": true, \"state\": \"arizona\", \"limit\": 50}"
```

**California:**
```bash
curl -s -X POST "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrich-civic" \
  -H "Content-Type: application/json" \
  -H "X-Enrichment-Key: YOUR_ENRICHMENT_KEY" \
  -d "{\"batch\": true, \"state\": \"california\", \"limit\": 50}"
```

**Progress (no auth, open in browser):**  
https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrich-civic?stats

---

## Fields for Supabase integration

Use these when configuring an HTTP trigger (Dashboard Scheduled Invocation, pg_cron + pg_net, or external cron).

| Field | Value |
|-------|--------|
| **URL** | `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrich-civic` |
| **Method** | `POST` |
| **Headers** | See below |
| **Body (batch)** | See below |
| **Body (single agent)** | See below |

### Headers (required for POST; not needed for GET ?stats)

| Header name | Value | Notes |
|-------------|--------|--------|
| `Content-Type` | `application/json` | Required |
| `X-Enrichment-Key` | *(your secret)* | Same as enrichment-api. Stored in Supabase secrets as `ENRICHMENT_KEY` or `ENRICHMENT_API_KEY`. |

### Body – batch (backfill by state)

Processes up to `limit` agents in that state who don’t already have ProPublica data. Rate limit: 1 request/second to ProPublica inside the run.

| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `batch` | boolean | yes (for batch) | — | Must be `true` |
| `state` | string | no | `"arizona"` | State slug: `arizona`, `california`, `texas`, `florida`, `new_york`, `colorado` |
| `limit` | number | no | `10` | Agents per run. Clamped to 1–50. |

**Example body (batch):**
```json
{
  "batch": true,
  "state": "arizona",
  "limit": 50
}
```

### Body – single agent

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `professional_id` | string (UUID) | yes | `professionals.id` to enrich |

**Example body (single):**
```json
{
  "professional_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## Supabase Dashboard / external scheduler

- **URL:** `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrich-civic`
- **Method:** `POST`
- **Headers:**  
  `Content-Type: application/json`  
  `X-Enrichment-Key: <value from Supabase secrets ENRICHMENT_KEY or ENRICHMENT_API_KEY>`
- **Body (batch):** `{"batch": true, "state": "arizona", "limit": 50}` (change `state`/`limit` as needed)

To run for multiple states, schedule separate requests (e.g. one for `arizona`, one for `california`). Each run is independent; run repeatedly until the progress link shows no remaining.

---

## pg_cron + pg_net (optional)

If you use pg_cron and store the enrichment key in DB (e.g. `current_setting('app.settings.enrichment_key')`), call the function like this (run one state per schedule, e.g. Arizona daily at 2 AM UTC):

```sql
SELECT net.http_post(
  url := 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrich-civic',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'X-Enrichment-Key', current_setting('app.settings.enrichment_key', true)
  ),
  body := '{"batch": true, "state": "arizona", "limit": 50}'::jsonb
) AS request_id;
```

Ensure `app.settings.enrichment_key` is set (e.g. via `ALTER DATABASE ... SET app.settings.enrichment_key = 'your_key';` or your vault pattern).
