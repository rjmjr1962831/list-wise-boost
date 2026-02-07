-- Check for neighborhoods sharing the same coordinates (indicating placeholder data)
SELECT 
  lat, 
  lon, 
  COUNT(*) as neighborhood_count, 
  STRING_AGG(neighborhood, ', ') as neighborhoods 
FROM neighborhood_catalog 
WHERE primary_zip IN ('85033', '85301', '85303', '85201', '85258', '85251', '85716') 
  AND city_area_slug IN ('scottsdale', 'mesa', 'glendale', 'tucson', 'phoenix') 
GROUP BY lat, lon 
HAVING COUNT(*) > 5 
ORDER BY neighborhood_count DESC 
LIMIT 20;
