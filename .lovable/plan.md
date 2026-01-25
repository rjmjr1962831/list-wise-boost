

# California Neighborhood Bulk Ingestion Plan

## Overview

Ingest **~2,700 California neighborhoods** from the uploaded JSON file into the `neighborhood_catalog` table, ensuring no duplicates and proper state normalization.

## Data Summary

| Metric | Value |
|--------|-------|
| Records in uploaded file | ~2,700 neighborhoods |
| Current CA records in DB | 1,371 (68 as "CA" + 1,303 as "California") |
| Unique constraint | `(state, city_area_slug, neighborhood_slug)` |
| Deduplication method | Upsert with onConflict |

## Technical Approach

### Step 1: First Normalize Existing CA Records

Before ingestion, update the 68 records with `state = 'CA'` to `state = 'California'` to prevent constraint conflicts.

```sql
UPDATE neighborhood_catalog 
SET state = 'California', updated_at = NOW()
WHERE state = 'CA';
```

### Step 2: Create Ingestion Edge Function

Create a new edge function `ingest-ca-neighborhoods-osm` that:

1. **Accepts the JSON data** via POST body
2. **Normalizes fields:**
   - `city` → `city_area`
   - `city_slug` → `city_area_slug`
   - `name` → `neighborhood`
   - `slug` → `neighborhood_slug`
   - `state: "CA"` → `state: "California"`
3. **Deduplicates internally** (the uploaded file has duplicates from multiple sources like OSM and Zillow)
4. **Upserts in batches** of 100 records using the existing unique constraint
5. **Reports stats:** inserted, updated, skipped

### Step 3: Copy JSON to Project and Trigger Ingestion

1. Copy `ca_neighborhoods_final.json` to `src/data/`
2. Invoke the edge function with the data
3. Verify counts match expectations

## Field Mapping

| Uploaded JSON | Database Column | Notes |
|--------------|-----------------|-------|
| `name` | `neighborhood` | Display name |
| `slug` | `neighborhood_slug` | URL slug |
| `city` | `city_area` | Parent city |
| `city_slug` | `city_area_slug` | City URL slug |
| `state` | `state` | Normalized to "California" |
| `lat` | `lat` | Latitude |
| `lon` | `lon` | Longitude |
| `source` | (not stored) | OSM/Zillow source info dropped |
| `osm_id` / `zillow_region_id` | (not stored) | External IDs not needed |

## Default Values for Missing Fields

| Field | Default |
|-------|---------|
| `tier` | "Main" |
| `is_verified` | true |
| `is_active` | true |
| `zips` | [] (empty array) |
| `primary_zip` | null (to be enriched later) |
| `median_income` | null |
| `median_home_value` | null |

## Duplicate Handling

The uploaded file contains duplicates (same neighborhood from multiple sources like OSM and Zillow). The upsert operation will:

1. Keep the **first occurrence** with valid lat/lon
2. **Update** existing records if they have better data (lat/lon populated)
3. Use the unique constraint to prevent true duplicates

## Expected Outcome

| Current State | After Ingestion |
|--------------|-----------------|
| 1,371 CA neighborhoods | ~3,000-3,500 CA neighborhoods |
| 68 with state="CA" | 0 with state="CA" (all normalized) |
| Inconsistent data | All CA records use "California" |

## Files to Create/Modify

1. **Create:** `supabase/functions/ingest-ca-neighborhoods-osm/index.ts`
2. **Copy:** `user-uploads://ca_neighborhoods_final.json` → `src/data/caNeighborhoodsOsm.json`
3. **No routing changes** (this is backend-only)

## Execution Steps

1. Run SQL to normalize existing "CA" → "California"
2. Deploy new edge function
3. Invoke edge function with the full JSON payload
4. Verify counts and sample records
5. Report completion stats

