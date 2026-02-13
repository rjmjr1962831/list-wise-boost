# Vercel Deployment Protection Bypass

The Cloudflare Worker fetches content from `list-wise-boost.vercel.app`. If Vercel Deployment Protection is enabled, those fetches can be blocked. This project supports bypassing protection via the `x-vercel-protection-bypass` header.

## Setup

1. **Enable bypass in Vercel**
   - Project → Settings → Deployment Protection → enable "Protection Bypass for Automation"
   - Vercel provides a bypass key.

2. **Add the key as a Supabase secret**
   ```bash
   npx supabase secrets set VERCEL_PROTECTION_BYPASS=your_bypass_key --project-ref wiotrvoirdgzfacuuiem
   ```

3. **Redeploy the Worker**
   - Run `.\scripts\deploy-worker.ps1`
   - The `update-cloudflare-worker` function syncs `VERCEL_PROTECTION_BYPASS` to the Worker's secrets.

## Behavior

- When `VERCEL_PROTECTION_BYPASS` is set, the Worker adds `x-vercel-protection-bypass: <key>` to:
  - Human pass-through fetches to the origin
  - Puppeteer navigation (via `setExtraHTTPHeaders`)
  - Fallback fetches when rendering fails
- If the secret is not set, fetches proceed without the bypass header.
