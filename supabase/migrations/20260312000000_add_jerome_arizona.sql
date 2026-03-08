-- Add Jerome, Arizona to cities (historic mining town in Yavapai County)
INSERT INTO cities (name, state, state_slug, slug, active) VALUES
('Jerome', 'Arizona', 'arizona', 'jerome', true)
ON CONFLICT (state_slug, slug) DO NOTHING;
