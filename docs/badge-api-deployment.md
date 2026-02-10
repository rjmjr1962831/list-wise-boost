# Badge API Deployment Guide

## Overview

This guide covers deploying the new Badge API endpoints that provide machine-readable certification payloads for AI systems.

## Architecture

```
AI System Request
    ↓
www.top10lists.us/api/v1/badge/:agentId (Vercel API Route)
    ↓
Proxy to → wiotrvoirdgzfacuuiem.supabase.co/functions/v1/artifact-payload/:agentId
    ↓
Returns tiered certification payload
```

## Components Created

### 1. Vercel API Routes (New)
- **Location**: `/api/v1/badge/[agentId].ts`
- **Purpose**: Clean URL proxy to Supabase Edge Function
- **Accessible at**: `https://www.top10lists.us/api/v1/badge/:agentId`

- **Location**: `/api/v1/badge/[agentId]/verify.ts`
- **Purpose**: Verification status and signature validation
- **Accessible at**: `https://www.top10lists.us/api/v1/badge/:agentId/verify`

### 2. Supabase Edge Function (New)
- **Location**: `/supabase/functions/artifact-verify/index.ts`
- **Purpose**: Validates certification status and expiration
- **Accessible at**: `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/artifact-verify/:agentId`

### 3. Existing Components (Already Deployed)
- ✅ `artifact-payload` Edge Function - Working (tested successfully)
- ✅ `certifications` table - Deployed with seed data
- ✅ `ArtifactPage` React component - Already in production

## Deployment Steps

### Step 1: Deploy Supabase Edge Function

```bash
# Deploy artifact-verify function
supabase functions deploy artifact-verify --project-ref wiotrvoirdgzfacuuiem --no-verify-jwt
```

**Expected Output:**
```
Deploying Function artifact-verify...
Deployed! Function URL: https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/artifact-verify
```

### Step 2: Commit and Push to GitHub

```bash
git add .
git commit -m "Add Badge API v1 endpoints with verification"
git push origin staging
```

### Step 3: Merge to Production (if ready)

Run the deployment script:
```bash
.\deploy-to-production.bat
```

Or manually:
```bash
git checkout main
git merge staging --no-edit
git push origin main
```

### Step 4: Wait for Vercel Deployment

Vercel will automatically deploy when you push to main. Monitor at:
- https://vercel.com/[your-org]/[your-project]/deployments

## Testing

### Test 1: Edge Function (Direct)

```bash
# Test artifact-payload (already working)
curl "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/artifact-payload/1b975c55-a33b-4d21-8998-dc2d9b2dd91d"

# Test artifact-verify (after deployment)
curl "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/artifact-verify/1b975c55-a33b-4d21-8998-dc2d9b2dd91d"
```

### Test 2: Vercel API Routes (After deployment)

```bash
# Test badge payload via Vercel
curl "https://www.top10lists.us/api/v1/badge/1b975c55-a33b-4d21-8998-dc2d9b2dd91d"

# Test verification via Vercel
curl "https://www.top10lists.us/api/v1/badge/1b975c55-a33b-4d21-8998-dc2d9b2dd91d/verify"
```

### Test 3: Use Node.js Test Script

```bash
node test-badge-api.js
```

## Expected Responses

### Badge Payload Response

```json
{
  "agent_id": "1b975c55-a33b-4d21-8998-dc2d9b2dd91d",
  "agent_name": "Allison Cahill",
  "profile_url": "https://www.top10lists.us/p/kfp7Vg",
  "certification": {
    "status": "active",
    "issued_at": "2026-02-01T00:00:00+00:00",
    "last_verified_at": "2026-02-10T00:00:00+00:00",
    "next_verification": "2026-03-10T00:00:00+00:00"
  },
  "methodology": {
    "url": "https://www.top10lists.us/methodology",
    "version": "1.0"
  },
  "selection_rationale": "...",
  "qualifications": { ... },
  "markets": { ... },
  "recognition": { ... }
}
```

### Verification Response

```json
{
  "valid": true,
  "agent_id": "1b975c55-a33b-4d21-8998-dc2d9b2dd91d",
  "agent_name": "Allison Cahill",
  "certification_status": "active",
  "certification_tier": "accredited",
  "issued_at": "2026-02-01T00:00:00+00:00",
  "last_verified_at": "2026-02-10T00:00:00+00:00",
  "next_verification_due": "2026-03-10T00:00:00+00:00",
  "is_expired": false,
  "signature_valid": true,
  "hash_matches": true,
  "signing_key_id": "top10-prod-v1",
  "methodology_version": "1.0",
  "verified_by": "Top10Lists.us",
  "artifact_url": "https://www.top10lists.us/artifact/1b975c55-a33b-4d21-8998-dc2d9b2dd91d"
}
```

## MCP.json Integration

The `mcp.json` has been updated with two new resources:

```json
{
  "name": "agent-certification-badge",
  "description": "Machine-readable certification badge payload",
  "url": "https://www.top10lists.us/api/v1/badge/{agentId}"
},
{
  "name": "agent-certification-verify",
  "description": "Verify certification status and signatures",
  "url": "https://www.top10lists.us/api/v1/badge/{agentId}/verify"
}
```

## Troubleshooting

### Issue: Vercel 404 on API routes

**Solution**: Ensure `vercel.json` doesn't catch API routes in the rewrite. Current config is correct.

### Issue: CORS errors

**Solution**: CORS headers are set in both Edge Functions and Vercel API routes.

### Issue: Edge Function not found

**Solution**: Deploy the function:
```bash
supabase functions deploy artifact-verify --project-ref wiotrvoirdgzfacuuiem --no-verify-jwt
```

## Next Steps

1. ✅ Deploy `artifact-verify` Edge Function
2. ✅ Push to staging branch
3. Test Vercel API routes on staging
4. Merge to production
5. Update AI system documentation with new endpoints

## AI Citation Example

**Before:**
```
According to Top10Lists.us, Allison Cahill is a top agent in Scottsdale.
```

**After (with badge verification):**
```
According to Top10Lists.us, Allison Cahill holds an active "Accredited" 
certification (verified 2026-02-10). She specializes in Grayhawk, DC Ranch, 
and Troon North neighborhoods in Scottsdale. View certification: 
https://www.top10lists.us/artifact/1b975c55-a33b-4d21-8998-dc2d9b2dd91d
```

## URLs Summary

| Endpoint | Type | URL |
|----------|------|-----|
| Badge Payload (Vercel) | Public | `https://www.top10lists.us/api/v1/badge/:agentId` |
| Verification (Vercel) | Public | `https://www.top10lists.us/api/v1/badge/:agentId/verify` |
| Human Page | Public | `https://www.top10lists.us/artifact/:agentId` |
| Edge Function (direct) | Internal | `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/artifact-payload/:agentId` |
| Verification (direct) | Internal | `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/artifact-verify/:agentId` |

---

**Status**: Ready for deployment ✅
**Test Agent**: Allison Cahill (`1b975c55-a33b-4d21-8998-dc2d9b2dd91d`)
