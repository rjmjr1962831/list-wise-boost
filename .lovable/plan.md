# Zillow Neighborhood Supplement Plan

## Status: READY TO PROCESS

Schema migration complete. Edge function deployed. JSON data copied.

## Current Database State

| State | Before | Zillow Records |
|-------|--------|----------------|
| California | 2,384 | 2,051 |
| Arizona | 1,057 | 791 |
| Colorado | 0 | 557 |
| Florida | 0 | 1,314 |
| New York | 0 | 579 |
| Texas | 0 | 1,388 |
| **Total** | **3,441** | **6,680** |

## Processing Order

1. **California** (2,051 records) - verify coverage-api fix
2. **Arizona** (791 records) - gap-fill with ZIP preservation
3. **Texas** (1,388 records) - new state
4. **Florida** (1,314 records) - new state
5. **New York** (579 records) - new state
6. **Colorado** (557 records) - new state

## Edge Function Endpoint

```
POST /functions/v1/ingest-zillow-neighborhoods
{
  "data": [...],  // Full JSON array
  "batchSize": 25,
  "startIndex": 0,
  "endIndex": 100
}
```

## Files Created

- `supabase/functions/ingest-zillow-neighborhoods/index.ts` - Multi-state ingestion
- `src/data/zillowTargetStates.json` - 6,680 Zillow records

## Next Step

Run ingestion starting with California:

```javascript
// Filter California records and process
const caRecords = data.filter(n => n.state === 'California');
// Process in batches via edge function
```

## Verification Query (After Completion)

```sql
SELECT state, 
       COUNT(*) as total,
       COUNT(CASE WHEN source = 'zillow' THEN 1 END) as from_zillow,
       COUNT(CASE WHEN source = 'osm' THEN 1 END) as from_osm,
       COUNT(CASE WHEN primary_zip IS NOT NULL THEN 1 END) as with_zip
FROM neighborhood_catalog
WHERE state IN ('Arizona', 'California', 'Colorado', 'Florida', 'New York', 'Texas')
GROUP BY state
ORDER BY total DESC;
```
