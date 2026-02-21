-- Set Audited tier monthly price to $100 (was $50)
UPDATE certification_pricing_config
SET monthly_price = 100, updated_at = now()
WHERE tier = 'audited';

COMMENT ON COLUMN professionals.current_tier IS 'listed (default), certified (free + badge), audited ($100/mo, quarterly), underwritten ($150/mo)';
