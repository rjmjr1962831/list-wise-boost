// Neighborhood-Based Pricing Types
// Prices are DERIVED from pricing_configs, never stored in catalog

export type NeighborhoodTier = 'Main' | 'Prime' | 'Luxury';

// Base tier prices (derived from pricing_configs table)
export const NEIGHBORHOOD_TIER_PRICES: Record<NeighborhoodTier, number> = {
  Main: 39,
  Prime: 69,
  Luxury: 99
};

// Tier styling configuration
export const NEIGHBORHOOD_TIER_STYLES: Record<NeighborhoodTier, {
  border: string;
  bg: string;
  badge: string;
  text: string;
  color: string;
}> = {
  Main: {
    border: 'border-slate-300',
    bg: 'bg-gradient-to-br from-slate-50 to-gray-100',
    badge: 'bg-slate-500 text-white',
    text: 'text-slate-700',
    color: 'text-slate-600'
  },
  Prime: {
    border: 'border-blue-300',
    bg: 'bg-gradient-to-br from-blue-50 to-indigo-50',
    badge: 'bg-blue-600 text-white',
    text: 'text-blue-700',
    color: 'text-blue-600'
  },
  Luxury: {
    border: 'border-amber-300',
    bg: 'bg-gradient-to-br from-amber-50 to-yellow-50',
    badge: 'bg-amber-500 text-white',
    text: 'text-amber-700',
    color: 'text-amber-600'
  }
};

// Neighborhood catalog item (from database)
export interface NeighborhoodCatalogItem {
  id: string;
  state: string;
  city_area: string;
  city_area_slug: string;
  neighborhood: string;
  neighborhood_slug: string;
  zips: string[];
  lat: number | null;
  lon: number | null;
  median_income: number | null;
  median_home_value: number | null;
  tier: NeighborhoodTier;
  income_pct: number | null;
  value_pct: number | null;
  score: number | null;
  is_verified: boolean;
  is_active: boolean;
}

// Pricing config from database
export interface PricingConfig {
  id: string;
  config_version: string;
  scope_type: 'global' | 'state' | 'city' | 'zip';
  scope_key: string | null;
  tier_prices: Record<NeighborhoodTier, number>;
  market_multipliers: MarketMultiplier[];
  neighborhood_overrides: NeighborhoodOverride[];
  time_rules: TimeRule[];
  rounding: RoundingConfig;
  is_active: boolean;
  effective_from: string;
}

export interface MarketMultiplier {
  scope_type: 'zip' | 'city' | 'state';
  scope_key: string;
  multiplier: number;
}

export interface NeighborhoodOverride {
  neighborhood_slug: string;
  city_area_slug: string;
  state: string;
  price: number;
}

export interface TimeRule {
  effective_date: string;
  tier_prices: Partial<Record<NeighborhoodTier, number>>;
}

export interface RoundingConfig {
  method: 'nearest' | 'floor' | 'ceil';
  increment: number;
}

// Computed price result
export interface ComputedPrice {
  neighborhood: string;
  neighborhood_id: string;
  tier: NeighborhoodTier;
  base_price: number;
  final_price: number;
  price_source: string;
  multiplier_applied?: number;
  override_applied?: boolean;
}

// Agent neighborhood subscription
export interface AgentNeighborhoodSubscription {
  id: string;
  professional_id: string;
  neighborhood_id: string;
  neighborhood?: NeighborhoodCatalogItem;
  tier_at_purchase: NeighborhoodTier;
  price_paid: number;
  config_version_used: string | null;
  stripe_subscription_id: string | null;
  subscription_type: 'monthly' | 'annual' | 'free';
  is_active: boolean;
  started_at: string;
  expires_at: string | null;
}

// Helper function to compute price from config
export function computeNeighborhoodPrice(
  neighborhood: NeighborhoodCatalogItem,
  config: PricingConfig
): ComputedPrice {
  // Step 1: Get base tier price
  let price = config.tier_prices[neighborhood.tier];
  let priceSource = `tier_prices.${neighborhood.tier}`;
  let multiplierApplied: number | undefined;
  let overrideApplied = false;

  // Step 2: Apply time rules (most recent effective rule wins)
  const now = new Date();
  const applicableTimeRules = config.time_rules
    .filter(rule => new Date(rule.effective_date) <= now)
    .sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime());
  
  if (applicableTimeRules.length > 0 && applicableTimeRules[0].tier_prices[neighborhood.tier]) {
    price = applicableTimeRules[0].tier_prices[neighborhood.tier]!;
    priceSource = `time_rule.${applicableTimeRules[0].effective_date}`;
  }

  // Step 3: Apply market multipliers (most specific wins: ZIP > city > state)
  const zipMultiplier = config.market_multipliers.find(
    m => m.scope_type === 'zip' && neighborhood.zips.includes(m.scope_key)
  );
  const cityMultiplier = config.market_multipliers.find(
    m => m.scope_type === 'city' && m.scope_key === neighborhood.city_area_slug
  );
  const stateMultiplier = config.market_multipliers.find(
    m => m.scope_type === 'state' && m.scope_key === neighborhood.state
  );

  const multiplier = zipMultiplier || cityMultiplier || stateMultiplier;
  if (multiplier) {
    price = price * multiplier.multiplier;
    multiplierApplied = multiplier.multiplier;
    priceSource += ` × ${multiplier.scope_type}_multiplier(${multiplier.scope_key})`;
  }

  // Step 4: Apply neighborhood overrides (explicit override wins all)
  const override = config.neighborhood_overrides.find(
    o => o.neighborhood_slug === neighborhood.neighborhood_slug &&
         o.city_area_slug === neighborhood.city_area_slug &&
         o.state === neighborhood.state
  );
  if (override) {
    price = override.price;
    overrideApplied = true;
    priceSource = `neighborhood_override`;
  }

  // Step 5: Apply rounding
  const { method, increment } = config.rounding;
  if (method === 'nearest') {
    price = Math.round(price / increment) * increment;
  } else if (method === 'floor') {
    price = Math.floor(price / increment) * increment;
  } else if (method === 'ceil') {
    price = Math.ceil(price / increment) * increment;
  }

  return {
    neighborhood: neighborhood.neighborhood,
    neighborhood_id: neighborhood.id,
    tier: neighborhood.tier,
    base_price: config.tier_prices[neighborhood.tier],
    final_price: price,
    price_source: priceSource,
    multiplier_applied: multiplierApplied,
    override_applied: overrideApplied
  };
}

// Helper to get tier price (simple lookup for UI display)
export function getTierPrice(tier: NeighborhoodTier): number {
  return NEIGHBORHOOD_TIER_PRICES[tier];
}

// Helper to get annual price (10 months for price of 12)
export function getAnnualPrice(monthlyPrice: number): number {
  return monthlyPrice * 10; // 2 months free
}
