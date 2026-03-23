-- Split hybrid city_areas: Chandler/Gilbert → Chandler or Gilbert, Peoria/Surprise → Peoria or Surprise
-- Based on zip code and coordinate analysis. Run on staging only.
--
-- Chandler/Gilbert: 8 → Chandler, 11 → Gilbert (19 total)
-- Peoria/Surprise: 5 → Peoria, 10 → Surprise (15 total)

BEGIN;

-- ============================================================
-- Chandler/Gilbert → Chandler (8 neighborhoods)
-- ============================================================
UPDATE neighborhood_catalog
SET city_area = 'Chandler', city_area_slug = 'chandler', updated_at = NOW()
WHERE city_area = 'Chandler/Gilbert'
  AND id IN (
    '3d315da7-1270-47f5-8078-052e0a79c123', -- Arizona Estates (85286)
    '6ca1bb0c-69cf-46f7-b906-723ecef37cce', -- Canyon Oaks (85286)
    '704ac42b-23d2-4957-bf1e-2ecdf5c6bc4f', -- Carrizal (85286)
    '0ddfe0ab-b4d3-4ab8-8718-ceb1ec46e9ea', -- Colonial Coronita (85225)
    '3b6de3d2-92da-4fd2-92a5-a3230bd7d608', -- Heatherbrook (85224)
    '192a2905-78ad-4d3a-ad25-92a82e0247a3', -- Las Brisas (85286)
    '910c21fc-54ae-4598-adfe-8ac70f479689', -- Orangetree (85224)
    'b867b74c-56f5-47bd-9a5c-ce34a2b5b53e'  -- Rancho Del Ray (85286)
  );

-- ============================================================
-- Chandler/Gilbert → Gilbert (11 neighborhoods)
-- ============================================================
UPDATE neighborhood_catalog
SET city_area = 'Gilbert', city_area_slug = 'gilbert', updated_at = NOW()
WHERE city_area = 'Chandler/Gilbert'
  AND id IN (
    '4deefee3-229c-4142-855f-e58ac252718b', -- Allen Ranch (85295)
    '3332df3a-8285-451c-ae06-733a847dcc08', -- Gilbert Commons (85296)
    '16199b5e-598d-40fa-a031-3bc178a15362', -- Gilbert Ranch (85295)
    'bd3b5409-5d8c-465d-88e3-e971707f955c', -- Higley Park (85236)
    '30b882e3-9ffa-4f16-a450-139bae3a95cd', -- Jakes Ranch (85295)
    'db7f3b82-42d4-4e64-912b-304f36500f8d', -- Morrison Ranch (85236)
    '2148ed86-7288-4240-bcc3-fa17f04fc299', -- Ray Ranch (85236)
    'af35693f-dfce-4301-bc4f-bbf79d63b90e', -- Silverado (85295)
    '5fe21f6d-1458-4d1d-8f6e-f9a4887b8d6c', -- Sun Terra Acres (85296)
    'e47dcad3-aef3-4505-84d0-556490fae16d', -- The Spectrum at Val Vista (85295)
    'a1a1fd9e-e0fd-463a-9427-cd5ff79dfb89'  -- Vintage Ranch (85295)
  );

-- ============================================================
-- Peoria/Surprise → Peoria (5 neighborhoods)
-- ============================================================
UPDATE neighborhood_catalog
SET city_area = 'Peoria', city_area_slug = 'peoria', updated_at = NOW()
WHERE city_area = 'Peoria/Surprise'
  AND id IN (
    '168f4a8e-5637-4cc3-840d-4e3f71a29bcf', -- Coldwater Ranch (85373)
    '1d53925d-f620-4992-97f7-ed3f005d6d2a', -- Crossriver (85373)
    '324fc8bd-f481-4744-b1e9-f0b22c7db5ac', -- Dos Rios (85373)
    '72398434-3340-4cf8-86a5-6742fffa475e', -- Parkview Estates (85310)
    '48866173-4be8-440d-98a2-4fb588c0e802'  -- Pleasant Valley (85373)
  );

-- ============================================================
-- Peoria/Surprise → Surprise (10 neighborhoods)
-- ============================================================
UPDATE neighborhood_catalog
SET city_area = 'Surprise', city_area_slug = 'surprise', updated_at = NOW()
WHERE city_area = 'Peoria/Surprise'
  AND id IN (
    '3e5df6d4-5930-4a3a-8b52-411b90bb40da', -- Agua Fria (85363)
    'f66b8b5c-ec6b-4ace-bb7c-da6030ba5877', -- Camino Crossing (85375)
    '7635089d-cab6-41e5-a7d5-ce68683428bb', -- Corte Bella (85375)
    'f749241a-6d9c-40a0-ae81-09e2cc253fd1', -- Enclave (85375)
    '7a250484-d166-4b16-b5cb-62a1d3d0a2ce', -- Pueblo El Mirage RV & Golf Resort (85335)
    'ba0dbc49-3bea-41a9-a441-e170ca39f7ce', -- Pueblo El Mirage RV Resort (85335)
    '2f9075a2-d183-4248-adc2-99cbb3596033', -- Rancho Cabrillo (85375)
    '5f7ac491-96a3-4d6c-9b02-fdc70e682787', -- Seasons at Rancho Cabrillo (85375)
    'e0f8cab9-2eff-486c-92f3-1b349d375ee7', -- Sunleya (85375)
    '8ab0dd0c-1b36-4aeb-9c02-75bc890a51b9'  -- Surprise Original Townsite (85378)
  );

-- ============================================================
-- Verify: no rows should remain in hybrid city_areas
-- ============================================================
DO $$
DECLARE
  remaining INT;
BEGIN
  SELECT COUNT(*) INTO remaining
  FROM neighborhood_catalog
  WHERE city_area IN ('Chandler/Gilbert', 'Peoria/Surprise');

  IF remaining > 0 THEN
    RAISE EXCEPTION 'Migration incomplete: % rows still in hybrid city_areas', remaining;
  END IF;
END $$;

COMMIT;
