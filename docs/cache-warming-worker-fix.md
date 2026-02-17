# Cache Warming – Worker Integration Fix

## Problem

Bot cache hit rate was very low because:

- The **Worker** serves bots from the **Cache API** (`caches.default`).
- The **warm-cache** function was writing only to **Cloudflare KV**.
- The Worker never reads KV, so warmed content was never served to bots.

## Solution

1. **Worker** exposes a secure warm endpoint: `POST /__warm`.
2. **warm-cache** sends prerendered HTML to that endpoint so it is stored in the same Cache API the Worker uses for bot requests.

## Setup

### 1. Cloudflare Worker

- In the Worker’s **Settings** → **Variables and Secrets**, add:
  - **Variable**: `WARM_SECRET`
  - **Value**: a long random string (e.g. 32+ chars). Keep it secret.
- Redeploy the Worker after adding the secret.

### 2. Supabase (warm-cache)

- In **Supabase** → **Project Settings** → **Edge Functions** → **Secrets**, add:
  - **Name**: `WARM_SECRET`
  - **Value**: the **same** value as in the Worker.
- Redeploy the warm-cache function:

  ```bash
  npx supabase functions deploy warm-cache --project-ref wiotrvoirdgzfacuuiem
  ```

### 3. Run a full warm

From the admin UI, use **Warm all in background** (or **Full Cache Refresh**). warm-cache will:

1. Fetch prerendered HTML (Prerender.io or bot fetch).
2. Validate it (no empty shell).
3. **POST to `https://www.top10lists.us/__warm`** with `X-Warm-Secret` and `{ url, html }`.
4. Optionally continue writing to KV if KV credentials are set.

After warming, bot requests should hit the Worker’s cache and hit rate should increase.

## Security

- `POST /__warm` returns 401 unless the request includes `X-Warm-Secret: <WARM_SECRET>`.
- Use a strong, random value for `WARM_SECRET` and do not commit it.
