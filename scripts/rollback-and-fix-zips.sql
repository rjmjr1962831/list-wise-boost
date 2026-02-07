-- ROLLBACK: Restore incorrect updates back to 85033 temporarily
-- Then manually set correct zips for high-value neighborhoods

-- Step 1: Rollback Scottsdale neighborhoods that got wrong zips (most got 85258 but should be various)
UPDATE neighborhood_catalog 
SET primary_zip = '85033'
WHERE city_area_slug = 'scottsdale' 
  AND primary_zip = '85258'
  AND neighborhood IN (
    'Old Town', 'Arts Districts', 'Fashion Square', 'Monterey Arcadia',
    'Central Scottsdale', 'McDowell Mountain Ranch', 'Grayhawk', 
    'Desert Highlands', 'Troon North', 'Legend Trail', 'Boulders',
    'Boulders Carefree', 'Desert Foothills', 'Pinnacle Peak Estates',
    'Pinnacle Peak Vista', 'Reatta Pass-Troon', 'Troon Village',
    'Via Linda Corridor', 'Windgate Ranch', 'Happy Valley Ranch',
    'Mirabel Village', 'Dynamite Foothills', 'Ancala', 'Ironwood Village',
    'Pima Meadows', 'Sonoran', 'Sunrise Desert Vistas', 'West Cactus',
    'East Shea', 'Cactus Corridor', 'Horizons', 'Indian Bend',
    'Paseo Village', 'Resort Corridor', 'Stonegate', 'Prado Estates',
    'Goldie Brown Pinnacle Peak Ranch', 'Granite Mountain Ranch'
  );

-- Step 2: Now manually set CORRECT zips for key Scottsdale neighborhoods we know

-- Old Town Scottsdale (downtown/central) - 85251
UPDATE neighborhood_catalog 
SET primary_zip = '85251'
WHERE city_area_slug = 'scottsdale' 
  AND neighborhood IN ('Old Town', 'Arts Districts', 'Fashion Square', 'Scottsdale Country Club');

-- Scottsdale Ranch - 85251  
UPDATE neighborhood_catalog 
SET primary_zip = '85251'
WHERE city_area_slug = 'scottsdale' 
  AND neighborhood = 'Scottsdale Ranch';

-- North Scottsdale (Grayhawk, DC Ranch area) - 85255
UPDATE neighborhood_catalog 
SET primary_zip = '85255'
WHERE city_area_slug = 'scottsdale' 
  AND neighborhood IN ('Grayhawk', 'McDowell Mountain Ranch', 'Desert Highlands');

-- Far North Scottsdale (Troon, Cave Creek area) - 85262
UPDATE neighborhood_catalog 
SET primary_zip = '85262'
WHERE city_area_slug = 'scottsdale' 
  AND neighborhood IN ('Troon North', 'Troon Village', 'Reatta Pass-Troon', 'Desert Foothills');

-- Pinnacle Peak area - 85255
UPDATE neighborhood_catalog 
SET primary_zip = '85255'
WHERE city_area_slug = 'scottsdale' 
  AND neighborhood IN ('Pinnacle Peak Estates', 'Pinnacle Peak Vista', 'Happy Valley Ranch');

-- Boulders (Carefree area) - 85377
UPDATE neighborhood_catalog 
SET primary_zip = '85377'
WHERE city_area_slug = 'scottsdale' 
  AND neighborhood IN ('Boulders', 'Boulders Carefree');

-- Step 3: Keep the ones that are actually correct
-- Phoenix Maryvale neighborhoods ARE actually 85033, so leave them
-- Mesa got 85201 which is reasonable for central Mesa
-- Glendale got 85301/85303 which are reasonable
-- Tucson got 85716 which is reasonable for east Tucson

SELECT 'Rollback and manual fixes complete' as status;
