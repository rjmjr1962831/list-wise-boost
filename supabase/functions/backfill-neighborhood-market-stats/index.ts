// DEPRECATED — This edge function is no longer in active use. See docs/takeaways for context.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NeighborhoodCatalog {
  id: string;
  neighborhood: string;
  neighborhood_slug: string;
  city_area: string;
  city_area_slug: string;
  state: string;
  tier: string;
  primary_zip: string | null;
  median_home_value: number | null;
  median_income: number | null;
}

interface MarketStats {
  medianHomePrice: number;
  medianHouseholdIncome: number;
  medianRent: number;
  daysOnMarket: number;
  pricePerSqFt: number;
  yearOverYearChange: number;
  inventoryLevel: 'Low' | 'Moderate' | 'High';
  marketType: "Seller's Market" | 'Balanced' | "Buyer's Market";
  averageHomeSize: number;
  homeownershipRate: number;
  rentToIncomeRatio: number;
  rentalVacancyRate: number;
  pctRenterOccupied: number;
  metadata: {
    generatedAt: string;
    neighborhoodName: string;
    cityArea: string;
    state: string;
    stateAbbrev: string;
    primaryZip: string;
    version: string;
  };
}

function getStateAbbrev(state: string): string {
  const stateMap: Record<string, string> = {
    'arizona': 'AZ',
    'az': 'AZ',
    'california': 'CA',
    'texas': 'TX',
    'florida': 'FL',
    'colorado': 'CO',
    'nevada': 'NV',
  };
  return stateMap[state.toLowerCase()] || state.substring(0, 2).toUpperCase();
}

function generateMarketStats(neighborhood: NeighborhoodCatalog): MarketStats {
  const medianHomePrice = neighborhood.median_home_value || 350000;
  const medianIncome = neighborhood.median_income || 75000;
  const tier = neighborhood.tier?.toLowerCase() || 'main';
  
  // Calculate derived values based on tier and median values
  const tierMultipliers: Record<string, { rent: number; pricePerSqFt: number; homeSize: number; ownership: number }> = {
    'luxury': { rent: 0.004, pricePerSqFt: 450, homeSize: 3200, ownership: 0.82 },
    'prime': { rent: 0.0035, pricePerSqFt: 350, homeSize: 2400, ownership: 0.75 },
    'main': { rent: 0.003, pricePerSqFt: 250, homeSize: 1800, ownership: 0.65 },
  };
  
  const multipliers = tierMultipliers[tier] || tierMultipliers['main'];
  
  // Calculate median rent based on home price (roughly 0.3-0.4% monthly)
  const medianRent = Math.round(medianHomePrice * multipliers.rent);
  
  // Price per sqft based on tier
  const pricePerSqFt = Math.round(medianHomePrice / (medianHomePrice / multipliers.pricePerSqFt));
  
  // Days on market: luxury = fewer, main = more
  const daysOnMarket = tier === 'luxury' ? 45 + Math.floor(Math.random() * 20) 
    : tier === 'prime' ? 55 + Math.floor(Math.random() * 25)
    : 65 + Math.floor(Math.random() * 30);
  
  // YoY change based on tier (luxury more stable, main more variable)
  const yoyBase = tier === 'luxury' ? 2.5 : tier === 'prime' ? 3.5 : 4.5;
  const yearOverYearChange = yoyBase + (Math.random() * 4 - 2); // +/- 2%
  
  // Inventory level based on days on market
  const inventoryLevel: 'Low' | 'Moderate' | 'High' = 
    daysOnMarket < 50 ? 'Low' : daysOnMarket < 75 ? 'Moderate' : 'High';
  
  // Market type based on inventory
  const marketType: "Seller's Market" | 'Balanced' | "Buyer's Market" = 
    inventoryLevel === 'Low' ? "Seller's Market" 
    : inventoryLevel === 'Moderate' ? 'Balanced' 
    : "Buyer's Market";
  
  // Average home size based on tier
  const averageHomeSize = multipliers.homeSize + Math.floor(Math.random() * 400 - 200);
  
  // Homeownership rate based on tier
  const homeownershipRate = multipliers.ownership + (Math.random() * 0.1 - 0.05);
  
  // Rent to income ratio (typically 25-35%)
  const monthlyIncome = medianIncome / 12;
  const rentToIncomeRatio = medianRent / monthlyIncome;
  
  // Rental vacancy rate (typically 3-8%)
  const rentalVacancyRate = 0.03 + Math.random() * 0.05;
  
  // Percent renter occupied (inverse of homeownership)
  const pctRenterOccupied = 1 - homeownershipRate;

  return {
    medianHomePrice,
    medianHouseholdIncome: medianIncome,
    medianRent,
    daysOnMarket,
    pricePerSqFt: Math.round(medianHomePrice / averageHomeSize),
    yearOverYearChange: Math.round(yearOverYearChange * 10) / 10,
    inventoryLevel,
    marketType,
    averageHomeSize,
    homeownershipRate: Math.round(homeownershipRate * 1000) / 1000,
    rentToIncomeRatio: Math.round(rentToIncomeRatio * 1000) / 1000,
    rentalVacancyRate: Math.round(rentalVacancyRate * 1000) / 1000,
    pctRenterOccupied: Math.round(pctRenterOccupied * 1000) / 1000,
    metadata: {
      generatedAt: new Date().toISOString(),
      neighborhoodName: neighborhood.neighborhood,
      cityArea: neighborhood.city_area,
      state: neighborhood.state,
      stateAbbrev: getStateAbbrev(neighborhood.state),
      primaryZip: neighborhood.primary_zip || '',
      version: '1.0',
    },
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { limit = 500, dryRun = false, state: filterState, offset = 0 } = await req.json().catch(() => ({}));

    console.log(`[BackfillMarketStats] Starting backfill (limit: ${limit}, offset: ${offset}, dryRun: ${dryRun}, state: ${filterState || 'all'})`);

    // Fetch neighborhoods with offset-based pagination for resumable processing
    let query = supabase
      .from('neighborhood_catalog')
      .select('id, neighborhood, neighborhood_slug, city_area, city_area_slug, state, tier, primary_zip, median_home_value, median_income')
      .eq('is_active', true);
    
    if (filterState) {
      query = query.ilike('state', filterState);
    }
    
    const { data: neighborhoods, error: fetchError } = await query
      .order('city_area')
      .order('neighborhood')
      .range(offset, offset + limit - 1);

    if (fetchError) {
      throw new Error(`Failed to fetch neighborhoods: ${fetchError.message}`);
    }
    
    console.log(`[BackfillMarketStats] Fetched ${neighborhoods?.length || 0} neighborhoods starting at offset ${offset}`);

    if (!neighborhoods || neighborhoods.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No more neighborhoods to process',
          processed: 0,
          offset,
          complete: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process all fetched neighborhoods - upsert handles duplicates
    const results = { inserted: 0, errors: 0, errorDetails: [] as string[] };

    for (const neighborhood of neighborhoods) {
      try {
        const stats = generateMarketStats(neighborhood);
        
        if (dryRun) {
          console.log(`[DryRun] Would insert stats for ${neighborhood.neighborhood_slug}:`, stats);
          results.inserted++;
          continue;
        }

        const { error: insertError } = await supabase
          .from('marketing_content')
          .upsert({
            page: `neighborhood-${neighborhood.state.toLowerCase()}-${neighborhood.neighborhood_slug}`,
            section: 'market_stats',
            key: 'full_content',
            type: 'json',
            value: JSON.stringify(stats),
          }, { onConflict: 'page,section,key' });

        if (insertError) {
          console.error(`[BackfillMarketStats] Error inserting ${neighborhood.neighborhood_slug}:`, insertError);
          results.errors++;
          results.errorDetails.push(`${neighborhood.neighborhood_slug}: ${insertError.message}`);
        } else {
          results.inserted++;
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[BackfillMarketStats] Exception for ${neighborhood.neighborhood_slug}:`, err);
        results.errors++;
        results.errorDetails.push(`${neighborhood.neighborhood_slug}: ${errorMessage}`);
      }
    }

    const nextOffset = offset + neighborhoods.length;

    return new Response(
      JSON.stringify({
        success: true,
        processed: neighborhoods.length,
        inserted: results.inserted,
        errors: results.errors,
        errorDetails: results.errorDetails.slice(0, 10),
        nextOffset,
        complete: neighborhoods.length < limit,
        dryRun,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[BackfillMarketStats] Error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
