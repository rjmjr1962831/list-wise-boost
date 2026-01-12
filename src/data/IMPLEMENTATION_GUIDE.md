# Transaction-Based Neighborhood Activity - Implementation Guide

## Overview
This replaces office radius guessing with verified transaction data from Zillow.

**Data we have:**
- 11,878 agent-ZIP mappings from verified Zillow transaction history
- 3,024 qualified agents (4.8+ rating, 20+ reviews)
- 1,735 unique ZIP codes covered

---

## Step 1: Give Lovable the Prompt

Copy/paste the entire contents of `LOVABLE_PROMPT_transaction_based_activity.txt` into Lovable.

This will create:
- `neighborhood_zips` table
- `agent_zip_activity` table  
- `is_active` column on `neighborhood_experts`
- `get_neighborhood_active_agents()` function
- `get_neighborhood_agent_counts()` function
- `sync-neighborhood-experts` edge function

**Wait for Lovable to complete before proceeding to Step 2.**

---

## Step 2: Populate neighborhood_zips Table

Run `populate_neighborhood_zips.sql` in Supabase SQL Editor.

This maps ~20 Arizona neighborhoods to their ZIP codes:
- Arcadia → 85018, 85016
- North Scottsdale → 85255, 85258, 85259, 85260, 85262
- Paradise Valley → 85253, 85254
- Etc.

**Note:** Some neighborhoods share ZIPs (like 85018 covers both Arcadia and Camelback East). This is expected and correct.

---

## Step 3: Import Agent ZIP Activity Data

### Option A: Use CSV Import (Recommended for Large Data)

1. Go to Supabase Table Editor
2. Select `agent_zip_activity` table
3. Click "Insert" → "Import data from CSV"
4. Upload `agent_zip_activity.csv`
5. Map columns: license_number, state, zip_code, transaction_count
6. Click Import

### Option B: Run SQL INSERT Script

If CSV import doesn't work, run `insert_agent_zip_activity.sql` in SQL Editor.

**Warning:** This is 11,878 records in 119 batches. May take 2-3 minutes.

---

## Step 4: Verify Data Import

Run these validation queries in Supabase SQL Editor:

```sql
-- Check total records imported
SELECT COUNT(*) as total_records FROM agent_zip_activity;
-- Expected: 11,878

-- Check unique agents
SELECT COUNT(DISTINCT license_number || state) as unique_agents 
FROM agent_zip_activity;
-- Expected: ~2,900

-- Check unique ZIPs
SELECT COUNT(DISTINCT zip_code) as unique_zips 
FROM agent_zip_activity;
-- Expected: 1,735

-- Check Arizona coverage
SELECT COUNT(*) as az_records 
FROM agent_zip_activity 
WHERE state = 'AZ';
-- Expected: ~3,200
```

---

## Step 5: Test Queries

### Test 1: Get active agents for Arcadia

```sql
SELECT * FROM get_neighborhood_active_agents(
    (SELECT id FROM neighborhood_catalog WHERE slug = 'arcadia' LIMIT 1)
);
```

Expected: ~35 agents with verified transactions in ZIPs 85018, 85016

### Test 2: Get all neighborhoods with agent counts

```sql
SELECT * FROM get_neighborhood_agent_counts()
WHERE state = 'AZ'
ORDER BY active_agent_count DESC
LIMIT 10;
```

Expected: Mesa, Phoenix, Scottsdale at top with 100+ agents each

### Test 3: Check specific ZIP

```sql
SELECT 
    COUNT(*) as agent_count,
    SUM(transaction_count) as total_transactions
FROM agent_zip_activity
WHERE zip_code = '85018';
```

Expected: 20 agents, 21 total transactions

---

## Step 6: Sync Neighborhood Experts (Optional)

If you already have data in `neighborhood_experts` table, run the sync function to mark active/inactive:

```bash
curl -X POST https://bmxbpmpmvwcnxdisuonx.supabase.co/functions/v1/sync-neighborhood-experts \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

This will:
- Mark experts as `is_active = true` if they have transactions in neighborhood ZIPs
- Mark experts as `is_active = false` if they don't

---

## Step 7: Update Frontend (if needed)

If you're already displaying neighborhood experts, update the query to filter by is_active:

```typescript
const { data: experts } = await supabase
  .from('neighborhood_experts')
  .select('*, state_licenses(*)')
  .eq('neighborhood_id', neighborhoodId)
  .eq('is_active', true)  // Add this line
  .order('rank');
```

---

## Troubleshooting

### Issue: Import shows 0 records
**Cause:** Foreign key constraint - licenses not in state_licenses table
**Solution:** Import the Zillow enrichment data first (zillow_bulk_import_all_qualified.sql)

### Issue: Query returns no agents for a neighborhood
**Cause:** neighborhood_zips not populated for that neighborhood
**Solution:** Add ZIP mappings in populate_neighborhood_zips.sql

### Issue: Agents showing in wrong neighborhood
**Cause:** Incorrect ZIP mapping
**Solution:** Update neighborhood_zips table with correct ZIPs

---

## Expected Results

**For Arcadia (85018, 85016):**
- 35 qualified agents
- Sorted by verified transaction count
- Top agents: SA556582000 (4 transactions), SA644395000 (2 transactions)

**For All Arizona:**
- 278 unique qualified agents across all neighborhoods
- Mesa leads with 187 agents
- Phoenix has 278 agents across all neighborhoods
- Scottsdale has 167 agents

---

## What You've Built

**The competitive advantage:**

| Platform | Method | Defensible? |
|----------|--------|-------------|
| Zillow | Office location within 5 miles | No - guessing |
| Realtor.com | Office location radius | No - guessing |
| **Top10Lists** | **Verified transaction history** | **Yes - provable** |

You can now say: "We show agents with verified sales in this neighborhood, not agents with offices nearby."

---

## Next Steps

1. Expand to more neighborhoods (add to populate_neighborhood_zips.sql)
2. Add California, Texas, Florida ZIP mappings
3. Build automated monthly refresh (scrape new Zillow data)
4. Add lat/long storage for future polygon-based matching
