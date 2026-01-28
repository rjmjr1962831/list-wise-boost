
# Fix Zillow Rank Data for Arizona Agents

## Problem
600 Arizona agents have incorrect `zillow_search_city` data. Agents were searched in random cities (e.g., bulk job cycled through Cottonwood, Tucson, Prescott) instead of their actual business city (derived from `business_address.city`).

## Solution

### Step 1: Clear Bad Data (Database Migration)
Run SQL to NULL out all Zillow rank fields for active Arizona agents:

```sql
UPDATE professionals 
SET 
  zillow_search_city = NULL,
  zillow_search_position = NULL,
  zillow_search_total = NULL,
  zillow_search_page = NULL,
  zillow_rank_captured_at = NULL
WHERE 
  active = true 
  AND state_slug = 'arizona'
  AND zillow_search_city IS NOT NULL;
```

Expected: ~600 rows updated

### Step 2: Update enrichment-api Edge Function
Add Zillow rank fields to the allowed fields whitelist in both `action=update` and `action=bulk-update` sections:

**File:** `supabase/functions/enrichment-api/index.ts`

Add to both `allowedFields` arrays (lines ~197 and ~380):
- `zillow_search_city`
- `zillow_search_position`
- `zillow_search_total`
- `zillow_search_page`
- `zillow_rank_captured_at`

### Step 3: Update capture-zillow-rankings Function
Modify `supabase/functions/capture-zillow-rankings/index.ts` to determine search city from the agent's `business_address` rather than a passed-in city parameter.

**New Logic:**
```text
1. Accept either cityName OR agentId as input
2. If agentId provided:
   - Fetch agent's business_address from professionals table
   - Use business_address.city + business_address.state as search location
   - Fall back to zip_code lookup if no business_address
3. If cityName provided (bulk mode):
   - Query agents WHERE business_address->>'city' ILIKE cityName
   - Run Apify search for that city
   - Only update agents whose business city matches
```

**Key Change:** The function will validate that the agent's business_address.city matches the search city before updating rank data.

## Files Modified
| File | Change |
|------|--------|
| Database | Clear 5 Zillow fields for ~600 AZ agents |
| `enrichment-api/index.ts` | Add 5 fields to both allowedFields arrays |
| `capture-zillow-rankings/index.ts` | Add business_address city matching logic |

## Verification Query
After clearing data:
```sql
SELECT COUNT(*) FROM professionals 
WHERE active = true AND state_slug = 'arizona' AND zillow_search_city IS NOT NULL;
-- Expected: 0
```

## Future Workflow
When re-capturing Zillow ranks:
1. Run per-city capture (e.g., "Phoenix, AZ")
2. Function searches Zillow for that city
3. Function only updates agents whose `business_address.city` matches "Phoenix"
4. Agents with mismatched business cities are skipped, not polluted with wrong rank data
