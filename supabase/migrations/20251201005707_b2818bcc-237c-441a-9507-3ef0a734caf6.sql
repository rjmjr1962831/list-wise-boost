-- Add missing Arizona cities from arizonaComplete.json

INSERT INTO cities (name, state, state_slug, slug, active) VALUES
('Flagstaff', 'Arizona', 'arizona', 'flagstaff', true),
('Yuma', 'Arizona', 'arizona', 'yuma', true),
('Lake Havasu City', 'Arizona', 'arizona', 'lake-havasu-city', true),
('Prescott', 'Arizona', 'arizona', 'prescott', true),
('Prescott Valley', 'Arizona', 'arizona', 'prescott-valley', true),
('Sierra Vista', 'Arizona', 'arizona', 'sierra-vista', true),
('Kingman', 'Arizona', 'arizona', 'kingman', true),
('Bullhead City', 'Arizona', 'arizona', 'bullhead-city', true),
('Sedona', 'Arizona', 'arizona', 'sedona', true),
('Nogales', 'Arizona', 'arizona', 'nogales', true),
('Show Low', 'Arizona', 'arizona', 'show-low', true),
('Payson', 'Arizona', 'arizona', 'payson', true),
('Cottonwood', 'Arizona', 'arizona', 'cottonwood', true),
('Benson', 'Arizona', 'arizona', 'benson', true),
('Douglas', 'Arizona', 'arizona', 'douglas', true),
('Winslow', 'Arizona', 'arizona', 'winslow', true)
ON CONFLICT (slug, state_slug) DO NOTHING;