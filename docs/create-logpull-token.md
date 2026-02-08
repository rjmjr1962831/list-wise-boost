# Create New Cloudflare API Token for Logpull

## Important: Logpull requires ACCOUNT-level permissions

### Steps:

1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Click "Create Custom Token"
4. Configure:
   - Token name: `top10lists-logpull-read`
   - **Permissions:**
     - **Account** → Logs → **Read**
   - **Account Resources:**
     - Include → Your Account (should show account name)
   - **Zone Resources:**
     - Include → Specific zone → `top10lists.us`
5. Continue to summary → Create Token
6. **COPY THE TOKEN** (you can't view it again!)
7. Paste the token when prompted

### Why Account-level?
Cloudflare Logpull API requires account-level permissions even though you're accessing zone logs. Zone-level permissions will result in 403 Forbidden errors.
