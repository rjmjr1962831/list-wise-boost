import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QuoteCartRequest {
  neighborhood_ids: string[];
  config_version?: string;
}

interface QuoteItem {
  neighborhood_id: string;
  neighborhood: string;
  city_area: string;
  tier: 'Main' | 'Prime' | 'Luxury';
  final_price_monthly: number;
  price_source: string;
}

interface QuoteCartResponse {
  config_version_used: string;
  items: QuoteItem[];
  total_monthly: number;
  total_annual: number;
}

interface PricingConfig {
  id: string;
  config_version: string;
  scope_type: string;
  scope_key: string | null;
  tier_prices: Record<string, number>;
  market_multipliers: any[] | null;
  neighborhood_overrides: any[] | null;
  time_rules: any[] | null;
  rounding: { method: string; increment: number } | null;
  is_active: boolean;
  effective_from: string | null;
}

function applyRounding(price: number, rounding: { method: string; increment: number } | null): number {
  if (!rounding) return Math.round(price);
  
  const { method, increment } = rounding;
  
  switch (method) {
    case 'nearest':
      return Math.round(price / increment) * increment;
    case 'up':
    case 'ceil':
      return Math.ceil(price / increment) * increment;
    case 'down':
    case 'floor':
      return Math.floor(price / increment) * increment;
    default:
      return Math.round(price);
  }
}

function computePriceForNeighborhood(
  neighborhood: any,
  config: PricingConfig
): { final_price: number; price_source: string } {
  const tier = neighborhood.tier || 'Main';
  
  // Step 1: Get base tier price
  const tierPrices = config.tier_prices as Record<string, number>;
  let basePrice = tierPrices[tier] || tierPrices['Main'] || 39;
  let priceSource = 'tier_base';

  // Step 2: Apply time rules if effective_date <= now
  if (config.time_rules && Array.isArray(config.time_rules)) {
    const now = new Date();
    for (const rule of config.time_rules) {
      if (rule.effective_date && new Date(rule.effective_date) <= now) {
        if (rule.tier_prices && rule.tier_prices[tier]) {
          basePrice = rule.tier_prices[tier];
          priceSource = `time_rule_${rule.effective_date}`;
        }
      }
    }
  }

  // Step 3: Apply market multipliers (ZIP > city > state precedence)
  let multiplier = 1.0;

  if (config.market_multipliers && Array.isArray(config.market_multipliers) && neighborhood.zips) {
    const zips = Array.isArray(neighborhood.zips) ? neighborhood.zips : [neighborhood.zips];
    
    // Check ZIP-level multipliers
    for (const zip of zips) {
      const zipMultiplier = config.market_multipliers.find(
        (m: any) => m.scope === 'zip' && m.key === zip
      );
      if (zipMultiplier) {
        multiplier = zipMultiplier.multiplier;
        priceSource = `zip_${zip}`;
        break;
      }
    }

    // If no ZIP match, check city-level
    if (multiplier === 1.0 && neighborhood.city_area) {
      const cityMultiplier = config.market_multipliers.find(
        (m: any) => m.scope === 'city' && m.key?.toLowerCase() === neighborhood.city_area?.toLowerCase()
      );
      if (cityMultiplier) {
        multiplier = cityMultiplier.multiplier;
        priceSource = `city_${neighborhood.city_area}`;
      }
    }

    // If no city match, check state-level
    if (multiplier === 1.0) {
      const stateMultiplier = config.market_multipliers.find(
        (m: any) => m.scope === 'state' && m.key === neighborhood.state
      );
      if (stateMultiplier) {
        multiplier = stateMultiplier.multiplier;
        priceSource = `state_${neighborhood.state}`;
      }
    }
  }

  let price = basePrice * multiplier;

  // Step 4: Apply neighborhood overrides
  if (config.neighborhood_overrides && Array.isArray(config.neighborhood_overrides) && neighborhood.neighborhood) {
    const override = config.neighborhood_overrides.find(
      (o: any) => o.neighborhood?.toLowerCase() === neighborhood.neighborhood?.toLowerCase() ||
                  o.neighborhood_slug === neighborhood.neighborhood_slug
    );
    if (override && override.price) {
      price = override.price;
      priceSource = 'neighborhood_override';
    }
  }

  // Step 5: Apply rounding
  const finalPrice = applyRounding(price, config.rounding);

  return { final_price: finalPrice, price_source: priceSource };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const request: QuoteCartRequest = await req.json();
    console.log('[quote-neighborhood-cart] Request:', request);

    const { neighborhood_ids, config_version } = request;

    if (!neighborhood_ids || !Array.isArray(neighborhood_ids) || neighborhood_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'neighborhood_ids array is required and must not be empty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all neighborhoods in one query
    const { data: neighborhoods, error: neighborhoodError } = await supabase
      .from('neighborhood_catalog')
      .select('*')
      .in('id', neighborhood_ids);

    if (neighborhoodError) {
      throw new Error(`Failed to fetch neighborhoods: ${neighborhoodError.message}`);
    }

    if (!neighborhoods || neighborhoods.length === 0) {
      throw new Error('No neighborhoods found for the provided IDs');
    }

    // Get distinct states for config lookup
    const states = [...new Set(neighborhoods.map(n => n.state))];

    // Fetch active pricing config
    let configQuery = supabase
      .from('pricing_configs')
      .select('*')
      .eq('is_active', true);

    if (config_version) {
      configQuery = configQuery.eq('config_version', config_version);
    }

    const { data: configs, error: configError } = await configQuery
      .order('effective_from', { ascending: false, nullsFirst: false });

    if (configError || !configs || configs.length === 0) {
      throw new Error('No active pricing config found');
    }

    // Find the best config (prefer state-specific, fall back to global)
    const stateConfig = configs.find((c: PricingConfig) => 
      c.scope_type === 'state' && states.includes(c.scope_key || '')
    );
    const globalConfig = configs.find((c: PricingConfig) => c.scope_type === 'global');
    const config = stateConfig || globalConfig;

    if (!config) {
      throw new Error('No applicable pricing config found');
    }

    console.log('[quote-neighborhood-cart] Using config:', config.config_version, config.scope_type);

    // Compute price for each neighborhood
    const items: QuoteItem[] = [];
    let totalMonthly = 0;

    for (const neighborhood of neighborhoods) {
      const { final_price, price_source } = computePriceForNeighborhood(neighborhood, config);
      
      items.push({
        neighborhood_id: neighborhood.id,
        neighborhood: neighborhood.neighborhood,
        city_area: neighborhood.city_area,
        tier: neighborhood.tier as 'Main' | 'Prime' | 'Luxury',
        final_price_monthly: final_price,
        price_source
      });

      totalMonthly += final_price;
    }

    // Annual = 10 months (pay for 10, get 12 - 2 months free)
    const totalAnnual = totalMonthly * 10;

    const response: QuoteCartResponse = {
      config_version_used: config.config_version,
      items,
      total_monthly: totalMonthly,
      total_annual: totalAnnual
    };

    console.log('[quote-neighborhood-cart] Result:', {
      itemCount: items.length,
      totalMonthly,
      totalAnnual,
      configVersion: config.config_version
    });

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[quote-neighborhood-cart] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
