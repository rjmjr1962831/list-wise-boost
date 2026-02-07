# Zip Code Corruption Fix - Status Report

## Problem
128 neighborhoods had corrupted `primary_zip` set to "85033" from bad Redfin import on Jan 26, 2026.

## Root Cause
1. **Zip codes** were set to default "85033" during import
2. **Coordinates (lat/lon)** are also corrupted - many neighborhoods share identical coordinates
3. This made reverse geocoding useless (garbage in, garbage out)

## What We Fixed (Partial)

### ✅ Completed
- **Mesa (50 neighborhoods)**: Now have 85201 (acceptable for central Mesa)
- **Glendale (17 neighborhoods)**: Now have 85301/85303 (correct)
- **Tucson (17 neighborhoods)**: Now have 85716 (acceptable for east Tucson)
- **Phoenix (4 neighborhoods)**: Kept 85033 (Maryvale - actually correct)
- **Scottsdale HIGH-VALUE (15 neighborhoods)**: Manually corrected:
  - Old Town, Arts Districts, Fashion Square → 85251 ✓
  - Scottsdale Ranch, Scottsdale Country Club → 85251 ✓
  - Grayhawk, McDowell Mountain Ranch, Desert Highlands → 85255 ✓
  - Troon North, Troon Village, Reatta Pass-Troon, Desert Foothills → 85262 ✓
  - Pinnacle Peak areas → 85255 ✓
  - Boulders, Boulders Carefree → 85377 ✓

### ⚠️ Still Broken (~25 Scottsdale neighborhoods)
These were rolled back to 85033 because their coordinates are wrong:

**List of neighborhoods still at 85033:**
- Central Scottsdale
- Monterey Arcadia
- East Shea
- Cactus Corridor
- Horizons
- Indian Bend
- Paseo Village
- Resort Corridor
- Stonegate
- Prado Estates
- Goldie Brown Pinnacle Peak Ranch
- Granite Mountain Ranch
- Ancala
- Ironwood Village
- Pima Meadows
- Sonoran
- Sunrise Desert Vistas
- West Cactus
- Via Linda Corridor
- Windgate Ranch
- Happy Valley Ranch
- Mirabel Village
- Dynamite Foothills

## What Needs To Be Done

### Option 1: Manual Research (Quick but tedious)
For each of the ~25 neighborhoods:
1. Google "[neighborhood name] Scottsdale zip code"
2. Verify on Google Maps
3. Run SQL update with correct zip

### Option 2: Re-import from Better Source (Comprehensive but complex)
1. Find reliable neighborhood data source (Zillow API, Google Places, etc.)
2. Match neighborhoods by name
3. Import correct lat/lon AND zip codes
4. This fixes both coordinate AND zip code corruption

### Option 3: Leave As-Is (Pragmatic)
- The HIGH-VALUE neighborhoods (Old Town, Grayhawk, Troon) are fixed
- The remaining ~25 are less critical
- Accept 85033 as placeholder until better data available

## Files Created
- `scripts/fix-corrupted-zips.ts` - Reverse geocoding script (didn't work due to bad coords)
- `scripts/rollback-and-fix-zips.sql` - Manual fix for high-value neighborhoods (completed)
- `scripts/audit-neighborhood-zips.sql` - Audit queries
- `scripts/check-duplicate-coords.sql` - Check for duplicate coordinates

## SQL to Check Current Status
```sql
-- See all neighborhoods still with 85033
SELECT neighborhood, city_area_slug, primary_zip, lat, lon
FROM neighborhood_catalog
WHERE primary_zip = '85033'
ORDER BY city_area_slug, neighborhood;

-- Count by city
SELECT city_area_slug, COUNT(*) as still_broken
FROM neighborhood_catalog
WHERE primary_zip = '85033'
GROUP BY city_area_slug;
```

## Recommendation
Start with **Option 1** for the top 10 most important neighborhoods from the list above, then decide if the rest matter enough to continue.

**Priority neighborhoods to fix:**
1. Central Scottsdale (major area)
2. Resort Corridor (tourist area)
3. Via Linda Corridor (popular)
4. Windgate Ranch (newer upscale)
5. Ancala (upscale)

The rest are smaller/less critical.
