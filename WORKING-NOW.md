# ✅ Badge API - Working URLs (NOW)

## 🎯 Use These URLs Right Now

These Edge Function URLs are **fully operational and returning proper JSON**:

### Badge Payload
```
https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/artifact-payload/{agentId}
```

**Example:**
```bash
curl "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/artifact-payload/1b975c55-a33b-4d21-8998-dc2d9b2dd91d"
```

**Response:**
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

---

### Verification
```
https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/artifact-verify/{agentId}
```

**Example:**
```bash
curl "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/artifact-verify/1b975c55-a33b-4d21-8998-dc2d9b2dd91d"
```

**Response:**
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
  "signature_valid": false,
  "hash_matches": false,
  "signing_key_id": "top10-prod-v1",
  "methodology_version": "1.0",
  "verified_by": "Top10Lists.us",
  "artifact_url": "https://www.top10lists.us/artifact/1b975c55-a33b-4d21-8998-dc2d9b2dd91d"
}
```

---

## 📊 Status

| Feature | Status |
|---------|--------|
| Edge Functions | ✅ Working Now |
| JSON Responses | ✅ Working Now |
| Cache Headers | ✅ Proper (3600s for payload, 300s for verify) |
| CORS | ✅ Enabled |
| Test Data | ✅ Allison Cahill seeded |

---

## 🔄 Vercel URLs (Coming Soon)

Once Vercel builds successfully and cache clears, these will also work:
- `https://www.top10lists.us/api/v1/badge/{agentId}`
- `https://www.top10lists.us/api/v1/badge/{agentId}/verify`

**Until then:** Use the Edge Function URLs above ⬆️

---

## 🧪 Test Script

```bash
# Test Badge Payload
curl -s "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/artifact-payload/1b975c55-a33b-4d21-8998-dc2d9b2dd91d" | jq '.agent_name, .certification.status'

# Test Verification
curl -s "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/artifact-verify/1b975c55-a33b-4d21-8998-dc2d9b2dd91d" | jq '.valid, .certification_tier'
```

---

**Last Updated:** 2026-02-10  
**Test Agent:** Allison Cahill (Scottsdale)  
**Agent ID:** `1b975c55-a33b-4d21-8998-dc2d9b2dd91d`
