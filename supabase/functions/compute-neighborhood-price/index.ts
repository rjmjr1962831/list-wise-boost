import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

interface ComputePriceRequest {
  neighborhood_id?: string;
  state?: string;
  city_area?: string;
  neighborhood?: string;
  tier?: string;
}

interface ComputePriceResponse {
  neighborhood: string;
  neighborhood_id?: string;
  city_area: string;
  state: string;
  tier: string;
  base_price: number;
  multiplier: number;
  override_price: number | null;
  final_price: number;
  config_version: string;
  price_source: string;
}

function applyRounding(price: number, rounding: { method: string; increment: number } | null): number {
  if (!rounding) return Math.round(price);
  
  const { method, increment } = rounding;
  
  switch (method) {
    case 'nearest':
      return Math.round(price / increment) * increment;
    case 'up':
      return Math.ceil(price / increment) * increment;
    case 'down':
      return Math.floor(price / increment) * increment;
    default:
      return Math.round(price);
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const request: ComputePriceRequest = await req.json();
    console.log('[compute-neighborhood-price] Request:', request);

    // Step 1: Look up neighborhood in catalog to get tier
    let neighborhood: any = null;
    
    if (request.neighborhood_id) {
      const { data, error } = await supabase
        .from('neighborhood_catalog')
        .select('*')
        .eq('id', request.neighborhood_id)
        .single();
      
      if (error || !data) {
        throw new Error(`Neighborhood not found: ${request.neighborhood_id}`);
      }
      neighborhood = data;
    } else if (request.state && request.city_area && request.neighborhood) {
      const { data, error } = await supabase
        .from('neighborhood_catalog')
        .select('*')
        .eq('state', request.state)
        .ilike('city_area', request.city_area)
        .ilike('neighborhood', request.neighborhood)
        .single();
      
      if (error || !data) {
        // Try fuzzy match
        const { data: fuzzyData } = await supabase
          .from('neighborhood_catalog')
          .select('*')
          .eq('state', request.state)
          .ilike('neighborhood', `%${request.neighborhood}%`)
          .limit(1);
        
        if (fuzzyData && fuzzyData.length > 0) {
          neighborhood = fuzzyData[0];
        } else {
          throw new Error(`Neighborhood not found: ${request.neighborhood} in ${request.city_area}, ${request.state}`);
        }
      } else {
        neighborhood = data;
      }
    } else if (request.tier) {
      // Direct tier lookup without neighborhood (for pricing display)
      neighborhood = { tier: request.tier, state: request.state || 'AZ' };
    } else {
      throw new Error('Must provide neighborhood_id, or (state, city_area, neighborhood), or tier');
    }

    const tier = neighborhood.tier || 'Main';
    const state = neighborhood.state || 'AZ';

    // Step 2: Fetch active pricing config (most specific scope wins)
    // Priority: neighborhood override > city > state > global
    const { data: configs, error: configError } = await supabase
      .from('pricing_configs')
      .select('*')
      .eq('is_active', true)
      .or(`scope_type.eq.global,and(scope_type.eq.state,scope_key.eq.${state})`)
      .order('effective_from', { ascending: false, nullsFirst: false });

    if (configError || !configs || configs.length === 0) {
      throw new Error('No active pricing config found');
    }

    // Find the most specific applicable config
    let config: PricingConfig = configs.find((c: PricingConfig) => c.scope_type === 'state' && c.scope_key === state) 
      || configs.find((c: PricingConfig) => c.scope_type === 'global')!;

    console.log('[compute-neighborhood-price] Using config:', config.config_version, config.scope_type);

    // Step 3: Get base tier price
    const tierPrices = config.tier_prices as Record<string, number>;
    let basePrice = tierPrices[tier] || tierPrices['Main'] || 39;

    // Step 4: Apply time rules if effective_date <= now
    if (config.time_rules && Array.isArray(config.time_rules)) {
      const now = new Date();
      for (const rule of config.time_rules) {
        if (rule.effective_date && new Date(rule.effective_date) <= now) {
          if (rule.tier_prices && rule.tier_prices[tier]) {
            basePrice = rule.tier_prices[tier];
            console.log(`[compute-neighborhood-price] Applied time rule from ${rule.effective_date}`);
          }
        }
      }
    }

    // Step 5: Apply market multipliers (ZIP > city > state precedence)
    let multiplier = 1.0;
    let priceSource = 'tier_base';

    if (config.market_multipliers && Array.isArray(config.market_multipliers) && neighborhood.zips) {
      // Check ZIP-level multipliers
      const zips = Array.isArray(neighborhood.zips) ? neighborhood.zips : [neighborhood.zips];
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
          (m: any) => m.scope === 'state' && m.key === state
        );
        if (stateMultiplier) {
          multiplier = stateMultiplier.multiplier;
          priceSource = `state_${state}`;
        }
      }
    }

    let price = basePrice * multiplier;

    // Step 6: Apply neighborhood overrides (explicit override wins all)
    let overridePrice: number | null = null;
    if (config.neighborhood_overrides && Array.isArray(config.neighborhood_overrides) && neighborhood.neighborhood) {
      const override = config.neighborhood_overrides.find(
        (o: any) => o.neighborhood?.toLowerCase() === neighborhood.neighborhood?.toLowerCase() ||
                    o.neighborhood_slug === neighborhood.neighborhood_slug
      );
      if (override && override.price) {
        overridePrice = override.price;
        price = override.price;
        priceSource = `override_${neighborhood.neighborhood}`;
      }
    }

    // Step 7: Apply rounding
    const finalPrice = applyRounding(price, config.rounding);

    const response: ComputePriceResponse = {
      neighborhood: neighborhood.neighborhood || '',
      neighborhood_id: neighborhood.id,
      city_area: neighborhood.city_area || '',
      state,
      tier,
      base_price: basePrice,
      multiplier,
      override_price: overridePrice,
      final_price: finalPrice,
      config_version: config.config_version,
      price_source: priceSource,
    };

    console.log('[compute-neighborhood-price] Result:', response);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[compute-neighborhood-price] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
