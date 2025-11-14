# Prerender.io Setup for Lovable Hosting

## Important: Lovable vs Traditional Hosting

Lovable projects don't use NGINX or Apache directly. The NGINX config you may see in Prerender.io docs is for **self-hosted servers only**.

For Lovable projects, Prerender.io works through **DNS-level routing**.

## Setup Steps (Already Completed)

✅ **Step 1**: DNS configured to point to Prerender.io
✅ **Step 2**: Prerender token added to Lovable secrets

## How It Works

When DNS is configured correctly:

1. **All traffic** (bots + humans) hits Prerender.io first
2. Prerender.io detects the user agent:
   - **If bot** (Googlebot, Bingbot, etc.): Serves pre-rendered HTML
   - **If human**: Forwards to your Lovable app origin
3. Your React app loads normally for humans
4. Bots get fully rendered HTML with all content

## DNS Configuration

Your DNS should have:
- **Root domain** (`@`): A record → Prerender.io IP
- **www subdomain**: CNAME → `service.prerender.io`

In Prerender.io dashboard:
- **Origin URL**: Your Lovable deployment URL (e.g., `https://your-project.lovable.app`)
- **Forward non-bot traffic**: Enabled

## No Code Changes Needed

The edge function (`supabase/functions/prerender-proxy/index.ts`) is **not needed** when using DNS-level routing. DNS-level routing happens before your app is even reached.

## Testing

Test bot rendering:
```bash
curl -A "Googlebot" https://top10lists.us/az/mesa
```

Should return fully rendered HTML with all agent data visible.

## Troubleshooting

- **Still seeing empty HTML?** Check DNS propagation (up to 48 hours)
- **Origin errors?** Verify origin URL in Prerender.io dashboard
- **Token issues?** Verify token is correct in Prerender.io dashboard

## Monitoring

Check the Prerender.io dashboard:
- **Requests**: See bot vs human traffic
- **Cache**: Monitor pre-rendered pages
- **Integration Status**: Should show "Active"
