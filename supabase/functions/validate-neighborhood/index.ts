import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidateNeighborhoodRequest {
  input_string: string;
  state: string;
  city_area?: string;
  limit?: number;
}

interface NeighborhoodSuggestion {
  id: string;
  neighborhood: string;
  neighborhood_slug: string;
  city_area: string;
  city_area_slug: string;
  state: string;
  tier: 'Main' | 'Prime' | 'Luxury';
  zips: string[];
  lat: number | null;
  lon: number | null;
  matched_via_alias?: boolean;
  alias_name?: string;
}

interface ValidateNeighborhoodResponse {
  found: boolean;
  suggestions: NeighborhoodSuggestion[];
  normalized_input: string;
  message: string | null;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const request: ValidateNeighborhoodRequest = await req.json();
    console.log('[validate-neighborhood] Request:', request);

    const { input_string, state, city_area, limit = 10 } = request;

    if (!input_string || !state) {
      return new Response(
        JSON.stringify({ error: 'input_string and state are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize input
    const normalizedInput = input_string.trim();
    const searchTerm = normalizedInput.toLowerCase();

    if (normalizedInput.length < 2) {
      return new Response(
        JSON.stringify({
          found: false,
          suggestions: [],
          normalized_input: normalizedInput,
          message: 'Please enter at least 2 characters'
        } as ValidateNeighborhoodResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the query for primary neighborhoods with fuzzy matching
    let query = supabase
      .from('neighborhood_catalog')
      .select('id, neighborhood, neighborhood_slug, city_area, city_area_slug, state, tier, zips, lat, lon')
      .eq('state', state)
      .eq('is_active', true);

    // If city_area is provided, filter to that city first
    if (city_area) {
      query = query.ilike('city_area', city_area);
    }

    // Fuzzy match on neighborhood or city_area
    query = query.or(`neighborhood.ilike.%${searchTerm}%,city_area.ilike.%${searchTerm}%`);

    const { data: rawResults, error: searchError } = await query.limit(limit * 3);

    if (searchError) {
      console.error('[validate-neighborhood] Search error:', searchError);
      throw new Error(`Search failed: ${searchError.message}`);
    }

    // Also search aliases - filter by state on the joined table
    const { data: aliasResults, error: aliasError } = await supabase
      .from('neighborhood_aliases')
      .select(`
        alias_slug,
        alias_name,
        neighborhood_catalog!inner (
          id, neighborhood, neighborhood_slug, city_area, city_area_slug, state, tier, zips, lat, lon, is_active
        )
      `)
      .ilike('alias_name', `%${searchTerm}%`)
      .eq('neighborhood_catalog.state', state)
      .eq('neighborhood_catalog.is_active', true)
      .limit(limit);

    if (aliasError) {
      console.error('[validate-neighborhood] Alias search error:', aliasError);
      // Don't throw - aliases are optional
    }

    // Sort primary results by relevance
    const sortedPrimaryResults = (rawResults || [])
      .map(item => {
        const neighborhoodLower = item.neighborhood.toLowerCase();
        const cityAreaLower = item.city_area.toLowerCase();
        
        let score = 3;
        
        if (neighborhoodLower === searchTerm) score = 0;
        else if (neighborhoodLower.startsWith(searchTerm)) score = 1;
        else if (cityAreaLower === searchTerm) score = 0.5;
        else if (cityAreaLower.startsWith(searchTerm)) score = 1.5;
        else if (neighborhoodLower.includes(searchTerm)) score = 2;
        else if (cityAreaLower.includes(searchTerm)) score = 2.5;
        
        return { ...item, _score: score, matched_via_alias: false, alias_name: undefined as string | undefined };
      })
      .sort((a, b) => a._score - b._score);

    // Process alias results
    const aliasItems = (aliasResults || [])
      .filter(item => item.neighborhood_catalog && (item.neighborhood_catalog as any).is_active)
      .map(item => {
        const nc = item.neighborhood_catalog as any;
        return {
          id: nc.id,
          neighborhood: nc.neighborhood,
          neighborhood_slug: nc.neighborhood_slug,
          city_area: nc.city_area,
          city_area_slug: nc.city_area_slug,
          state: nc.state,
          tier: nc.tier,
          zips: nc.zips || [],
          lat: nc.lat,
          lon: nc.lon,
          _score: 1.8, // Between starts-with and contains
          matched_via_alias: true,
          alias_name: item.alias_name
        };
      });

    // Merge and dedupe results
    const seenIds = new Set<string>();
    const mergedResults: NeighborhoodSuggestion[] = [];

    [...sortedPrimaryResults, ...aliasItems]
      .sort((a, b) => a._score - b._score)
      .forEach(item => {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          mergedResults.push({
            id: item.id,
            neighborhood: item.neighborhood,
            neighborhood_slug: item.neighborhood_slug,
            city_area: item.city_area,
            city_area_slug: item.city_area_slug,
            state: item.state,
            tier: item.tier as 'Main' | 'Prime' | 'Luxury',
            zips: item.zips || [],
            lat: item.lat,
            lon: item.lon,
            matched_via_alias: item.matched_via_alias,
            alias_name: item.alias_name
          });
        }
      });

    const suggestions = mergedResults.slice(0, limit);
    const found = suggestions.length > 0;

    // Log unrecognized inputs (only if input >= 3 chars and no results)
    if (!found && normalizedInput.length >= 3) {
      console.log('[validate-neighborhood] Logging unrecognized input:', normalizedInput);
      
      const { error: upsertError } = await supabase
        .from('unrecognized_neighborhoods')
        .upsert({
          input_string: normalizedInput,
          state: state,
          city_area: city_area || null,
          search_count: 1,
          last_searched_at: new Date().toISOString()
        }, {
          onConflict: 'input_string,state',
          ignoreDuplicates: false
        });

      if (upsertError) {
        console.log('[validate-neighborhood] Upsert to unrecognized_neighborhoods failed:', upsertError.message);
      }
    }

    const response: ValidateNeighborhoodResponse = {
      found,
      suggestions,
      normalized_input: normalizedInput,
      message: found ? null : "We couldn't find that neighborhood. Try a different spelling or nearby area."
    };

    console.log('[validate-neighborhood] Found', suggestions.length, 'results for:', normalizedInput);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[validate-neighborhood] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
