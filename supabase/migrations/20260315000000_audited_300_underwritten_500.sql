-- Audited $300/mo, Underwritten $500/mo
UPDATE certification_pricing_config
SET monthly_price = 300, updated_at = now()
WHERE tier = 'audited';

UPDATE certification_pricing_config
SET monthly_price = 500, updated_at = now()
WHERE tier = 'underwritten';

COMMENT ON COLUMN professionals.current_tier IS 'listed (default), certified (legacy, grandfathered), audited ($300/mo), underwritten ($500/mo)';
