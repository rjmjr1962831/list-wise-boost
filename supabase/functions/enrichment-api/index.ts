import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-enrichment-key',
};

// Known tables in the public schema
const KNOWN_TABLES = [
  'professionals', 'cities', 'categories', 'state_licenses', 'arizona_licenses',
  'professional_cities', 'agent_city_subscriptions', 'arizona_city_pricing',
  'canonical_city_rankings', 'pipedrive_sync_queue', 'pipedrive_sync_state',
  'contacts', 'appointments', 'enrichment_queue', 'funnel_events',
  'neighborhood_catalog'
];

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    
    // Validate enrichment API key
    const apiKey = req.headers.get('x-enrichment-key');
    const expectedKey = Deno.env.get('ENRICHMENT_API_KEY');
    
    if (!apiKey || apiKey !== expectedKey) {
      console.error('enrichment-api - Invalid or missing API key');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or missing X-Enrichment-Key header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ============ NEW: GET action=schema ============
    if (req.method === 'GET' && action === 'schema') {
      console.log('enrichment-api - Fetching database schema');
      
      const schemaInfo: Record<string, string[]> = {};
      
      // Fetch column info for each known table
      for (const table of KNOWN_TABLES) {
        try {
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .limit(1);
          
          if (!error && data && data.length > 0) {
            schemaInfo[table] = Object.keys(data[0]);
          } else if (!error) {
            // Table exists but empty - get columns another way
            const { data: emptyData } = await supabase.from(table).select('*').limit(0);
            schemaInfo[table] = [];
          }
        } catch (e) {
          // Table doesn't exist or access denied
          console.log(`enrichment-api - Could not access table ${table}`);
        }
      }
      
      return new Response(
        JSON.stringify({ schema: schemaInfo, tables_checked: KNOWN_TABLES.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ NEW: GET action=list-tables ============
    if (req.method === 'GET' && action === 'list-tables') {
      console.log('enrichment-api - Listing available tables');
      
      const availableTables: string[] = [];
      
      for (const table of KNOWN_TABLES) {
        try {
          const { error } = await supabase.from(table).select('*').limit(0);
          if (!error) {
            availableTables.push(table);
          }
        } catch (e) {
          // Table not accessible
        }
      }
      
      return new Response(
        JSON.stringify({ tables: availableTables, count: availableTables.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ NEW: GET action=audit ============
    if (req.method === 'GET' && action === 'audit') {
      console.log('enrichment-api - Running audit on key tables');
      
      const auditTables = ['professionals', 'cities', 'state_licenses', 'agent_city_subscriptions', 'arizona_city_pricing'];
      const audit: Record<string, { count: number; columns: string[]; sample?: Record<string, unknown> }> = {};
      
      for (const table of auditTables) {
        try {
          // Get count
          const { count, error: countError } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });
          
          // Get sample row
          const { data: sample, error: sampleError } = await supabase
            .from(table)
            .select('*')
            .limit(1)
            .maybeSingle();
          
          if (!countError) {
            audit[table] = {
              count: count || 0,
              columns: sample ? Object.keys(sample) : [],
              sample: sample || undefined
            };
          }
        } catch (e) {
          console.log(`enrichment-api - Could not audit table ${table}`);
        }
      }
      
      return new Response(
        JSON.stringify({ audit, tables_audited: Object.keys(audit).length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ NEW: GET action=fetch-unenriched ============
    if (req.method === 'GET' && action === 'fetch-unenriched') {
      const limit = parseInt(url.searchParams.get('limit') || '100');
      
      console.log(`enrichment-api - Fetching up to ${limit} unenriched professionals`);
      
      // Fetch professionals that need ANY enrichment (no rating or no reviews)
      const { data, error } = await supabase
        .from('professionals')
        .select(`
          id,
          name,
          zillow_profile_url,
          review_stars_rating,
          num_total_reviews,
          synthesized_bio,
          city_id,
          cities (
            name,
            state
          )
        `)
        .or('review_stars_rating.is.null,num_total_reviews.is.null,synthesized_bio.is.null')
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('enrichment-api - Database error:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`enrichment-api - Returning ${data?.length || 0} unenriched professionals`);
      
      return new Response(
        JSON.stringify({ professionals: data, count: data?.length || 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ NEW: POST action=bulk-update ============
    if (req.method === 'POST' && action === 'bulk-update') {
      const body = await req.json();
      const { updates } = body;

      if (!updates || !Array.isArray(updates)) {
        return new Response(
          JSON.stringify({ error: 'updates array is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`enrichment-api - Bulk updating ${updates.length} professionals`);

      // Allowed fields for bulk update
      const allowedFields = [
        'name', 'canonical_slug', 'description', 'years_experience', 'total_sales', 'current_listings',
        'agent_sales_stats', 'past_sales', 'specialty', 'certifications',
        'languages', 'service_areas', 'reviews_data', 'is_top_agent',
        'is_premier_agent', 'badges', 'platform_reviews', 'num_total_reviews',
        'review_stars_rating', 'has_recent_review', 'most_recent_review_date',
        'phone', 'email', 'website', 'company', 'business_name', 'address',
        'zip_code', 'image_url', 'headline', 'get_to_know_me', 'review_link',
        'profile_link', 'license_number', 'synthesized_bio', 'zillow_data_fetched_at',
        'zillow_search_city', 'zillow_search_position', 'zillow_search_total',
        'zillow_search_page', 'zillow_rank_captured_at',
        // Sales and pricing fields
        'sales_count_all_time', 'sales_count_last_year',
        'price_range_3yr_min', 'price_range_3yr_max', 'average_value_3yr',
        // Business location fields
        'business_city', 'business_state', 'business_zip',
        // Profile enhancement fields
        'selection_rationale', 'selection_rationale_generated_at',
        'press_mentions', 'awards_verified', 'notable_achievements',
        'community_roles', 'certifications_verified'
      ];

      const results: { id: string; success: boolean; error?: string }[] = [];
      let succeeded = 0;
      let failed = 0;

      for (const update of updates) {
        const { id, ...fields } = update;
        
        if (!id) {
          results.push({ id: 'unknown', success: false, error: 'Missing id' });
          failed++;
          continue;
        }

        // Filter to allowed fields
        const sanitizedUpdate: Record<string, unknown> = {};
        for (const field of allowedFields) {
          if (field in fields) {
            sanitizedUpdate[field] = fields[field];
          }
        }

        if (Object.keys(sanitizedUpdate).length === 0) {
          results.push({ id, success: false, error: 'No valid fields' });
          failed++;
          continue;
        }

        const { error } = await supabase
          .from('professionals')
          .update(sanitizedUpdate)
          .eq('id', id);

        if (error) {
          results.push({ id, success: false, error: error.message });
          failed++;
        } else {
          results.push({ id, success: true });
          succeeded++;
        }
      }

      console.log(`enrichment-api - Bulk update complete: ${succeeded} succeeded, ${failed} failed`);

      return new Response(
        JSON.stringify({ 
          processed: updates.length,
          succeeded,
          failed,
          results
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ NEW: POST action=query ============
    if (req.method === 'POST' && action === 'query') {
      const body = await req.json();
      const { table, select = '*', filters = [], limit = 100, offset = 0 } = body;

      if (!table) {
        return new Response(
          JSON.stringify({ error: 'table is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`enrichment-api - Custom query on ${table} with ${filters.length} filters`);

      // Build query - using any to avoid TypeScript depth issues with Supabase query builder
      // deno-lint-ignore no-explicit-any
      let queryBuilder: any = supabase.from(table).select(select);

      // Apply each filter
      for (const filter of filters) {
        const { field, operator, value } = filter;
        
        if (operator === 'eq') {
          queryBuilder = queryBuilder.eq(field, value);
        } else if (operator === 'neq') {
          queryBuilder = queryBuilder.neq(field, value);
        } else if (operator === 'gt') {
          queryBuilder = queryBuilder.gt(field, value);
        } else if (operator === 'gte') {
          queryBuilder = queryBuilder.gte(field, value);
        } else if (operator === 'lt') {
          queryBuilder = queryBuilder.lt(field, value);
        } else if (operator === 'lte') {
          queryBuilder = queryBuilder.lte(field, value);
        } else if (operator === 'like') {
          queryBuilder = queryBuilder.like(field, value);
        } else if (operator === 'ilike') {
          queryBuilder = queryBuilder.ilike(field, value);
        } else if (operator === 'is') {
          queryBuilder = queryBuilder.is(field, value);
        } else {
          console.log(`enrichment-api - Unknown operator: ${operator}`);
        }
      }

      // Apply pagination
      queryBuilder = queryBuilder.range(offset, offset + limit - 1);

      const { data, error } = await queryBuilder;

      if (error) {
        console.error('enrichment-api - Query error:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ data, count: data?.length || 0, offset, limit }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ EXISTING: GET action=fetch ============
    if (req.method === 'GET' && action === 'fetch') {
      const limit = parseInt(url.searchParams.get('limit') || '100');
      
      console.log(`enrichment-api - Fetching up to ${limit} professionals needing enrichment`);
      
      const { data, error } = await supabase
        .from('professionals')
        .select(`
          id,
          name,
          zillow_profile_url,
          city_id,
          cities (
            name,
            state
          )
        `)
        .is('zillow_data_fetched_at', null)
        .not('zillow_profile_url', 'is', null)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('enrichment-api - Database error:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`enrichment-api - Returning ${data?.length || 0} professionals`);
      
      return new Response(
        JSON.stringify({ professionals: data, count: data?.length || 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ EXISTING: POST action=update ============
    if (req.method === 'POST' && action === 'update') {
      const body = await req.json();
      const { professional_id, ...updateData } = body;

      if (!professional_id) {
        return new Response(
          JSON.stringify({ error: 'professional_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`enrichment-api - Updating professional ${professional_id}`);

      // Allowed fields that can be updated
      const allowedFields = [
        'name',
        'canonical_slug',
        'description',
        'years_experience',
        'total_sales',
        'current_listings',
        'agent_sales_stats',
        'past_sales',
        'zuid',
        'encoded_zuid',
        'screen_name',
        'zillow_data_fetched_at',
        'specialty',
        'certifications',
        'languages',
        'service_areas',
        'reviews_data',
        'is_top_agent',
        'is_premier_agent',
        'badges',
        'sidebar_video_url',
        'platform_reviews',
        'num_total_reviews',
        'review_stars_rating',
        'has_recent_review',
        'most_recent_review_date',
        'phone',
        'email',
        'website',
        'company',
        'business_name',
        'address',
        'zip_code',
        'image_url',
        'headline',
        'get_to_know_me',
        'review_link',
        'profile_link',
        'license_number',
        'license_type',
        'license_status',
        'professional_data',
        'professional_information',
        'agent_licenses',
        'phone_numbers',
        'business_address',
        'ratings',
        'team_display_information',
        'raw_scraper_data',
        'synthesized_bio',
        'profile_last_synthesized_at',
        'zillow_search_city',
        'zillow_search_position',
        'zillow_search_total',
        'zillow_search_page',
        'zillow_rank_captured_at',
        // Sales and pricing fields
        'sales_count_all_time',
        'sales_count_last_year',
        'price_range_3yr_min',
        'price_range_3yr_max',
        'average_value_3yr',
        // Business location fields
        'business_city',
        'business_state',
        'business_zip',
        // Profile enhancement fields
        'selection_rationale',
        'selection_rationale_generated_at',
        'press_mentions',
        'awards_verified',
        'notable_achievements',
        'community_roles',
        'certifications_verified'
      ];

      // Filter to only allowed fields
      const sanitizedUpdate: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (field in updateData) {
          sanitizedUpdate[field] = updateData[field];
        }
      }

      if (Object.keys(sanitizedUpdate).length === 0) {
        return new Response(
          JSON.stringify({ error: 'No valid fields to update' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('professionals')
        .update(sanitizedUpdate)
        .eq('id', professional_id)
        .select('id, name, review_stars_rating, num_total_reviews, synthesized_bio, active')
        .single();

      if (error) {
        console.error('enrichment-api - Update error:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`enrichment-api - Successfully updated professional ${professional_id}`);

      // Check if agent is qualified (4.8+ rating AND 20+ reviews) and needs synthesis
      const isQualified = data.review_stars_rating >= 4.8 && data.num_total_reviews >= 20;
      let synthesisTriggerResult = null;
      
      if (isQualified && !data.synthesized_bio) {
        console.log(`enrichment-api - Agent ${professional_id} is QUALIFIED, triggering synthesis...`);
        
        // Set active = true for qualified agents
        await supabase
          .from('professionals')
          .update({ active: true })
          .eq('id', professional_id);
        
        // Trigger synthesis in background
        try {
          const synthesisResponse = await fetch(`${supabaseUrl}/functions/v1/synthesize-agent-profile`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({ professional_id })
          });
          
          if (synthesisResponse.ok) {
            synthesisTriggerResult = 'triggered';
            console.log(`enrichment-api - Synthesis triggered for ${professional_id}`);
          } else {
            synthesisTriggerResult = `failed: ${synthesisResponse.status}`;
            console.error(`enrichment-api - Synthesis trigger failed: ${synthesisResponse.status}`);
          }
        } catch (synthError) {
          synthesisTriggerResult = `error: ${synthError instanceof Error ? synthError.message : 'unknown'}`;
          console.error('enrichment-api - Synthesis trigger error:', synthError);
        }
      } else if (isQualified) {
        console.log(`enrichment-api - Agent ${professional_id} is QUALIFIED but already has bio`);
        synthesisTriggerResult = 'skipped_has_bio';
      } else {
        console.log(`enrichment-api - Agent ${professional_id} is NOT qualified (rating: ${data.review_stars_rating}, reviews: ${data.num_total_reviews})`);
        synthesisTriggerResult = 'not_qualified';
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          updated: data, 
          fields_updated: Object.keys(sanitizedUpdate),
          qualified: isQualified,
          synthesis: synthesisTriggerResult
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ EXISTING: GET action=fetch_licenses ============
    if (req.method === 'GET' && action === 'fetch_licenses') {
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const stateParam = url.searchParams.get('state');
      
      console.log(`enrichment-api - Fetching up to ${limit} licenses needing Zillow scraping${stateParam ? ` for state: ${stateParam}` : ''}`);
      
      let query = supabase
        .from('state_licenses')
        .select('id, name, city, state, license_number')
        .is('zillow_scraped_at', null);
      
      // Apply optional state filter (normalize to uppercase)
      if (stateParam) {
        query = query.eq('state', stateParam.toUpperCase());
      }
      
      const { data, error } = await query
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('enrichment-api - Database error:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`enrichment-api - Returning ${data?.length || 0} licenses`);
      
      return new Response(
        JSON.stringify({ licenses: data, count: data?.length || 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ EXISTING: POST action=update_license ============
    if (req.method === 'POST' && action === 'update_license') {
      const body = await req.json();
      const { 
        license_id, 
        zillow_url, 
        zillow_rating, 
        zillow_reviews, 
        zillow_scraped_at, 
        zillow_status, 
        zillow_error 
      } = body;

      if (!license_id) {
        return new Response(
          JSON.stringify({ error: 'license_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`enrichment-api - Updating license ${license_id} with Zillow data`);

      const updateData: Record<string, unknown> = {
        zillow_scraped_at: zillow_scraped_at || new Date().toISOString(),
        zillow_status: zillow_status || 'found'
      };

      if (zillow_url !== undefined) updateData.zillow_url = zillow_url;
      if (zillow_rating !== undefined) updateData.zillow_rating = zillow_rating;
      if (zillow_reviews !== undefined) updateData.zillow_reviews = zillow_reviews;
      if (zillow_error !== undefined) updateData.zillow_error = zillow_error;

      const { data, error } = await supabase
        .from('state_licenses')
        .update(updateData)
        .eq('id', license_id)
        .select('id, name, zillow_rating, zillow_reviews, zillow_status')
        .single();

      if (error) {
        console.error('enrichment-api - Update license error:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`enrichment-api - Successfully updated license ${license_id}: rating=${zillow_rating}, reviews=${zillow_reviews}`);

      // Check if qualified for promotion
      const isQualified = (zillow_rating >= 4.8) && (zillow_reviews >= 20);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          updated: data,
          qualified: isQualified,
          message: isQualified ? 'Qualified! Call promote_to_professional to create agent.' : 'Not qualified (needs 4.8+ rating AND 20+ reviews)'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ EXISTING: POST action=promote_to_professional ============
    if (req.method === 'POST' && action === 'promote_to_professional') {
      const body = await req.json();
      const { license_id } = body;

      if (!license_id) {
        return new Response(
          JSON.stringify({ error: 'license_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`enrichment-api - Promoting license ${license_id} to professional`);

      // Fetch the license data
      const { data: license, error: fetchError } = await supabase
        .from('state_licenses')
        .select('*')
        .eq('id', license_id)
        .single();

      if (fetchError || !license) {
        console.error('enrichment-api - License not found:', fetchError);
        return new Response(
          JSON.stringify({ error: 'License not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check qualification
      if ((license.zillow_rating || 0) < 4.8 || (license.zillow_reviews || 0) < 20) {
        console.log(`enrichment-api - License ${license_id} not qualified: rating=${license.zillow_rating}, reviews=${license.zillow_reviews}`);
        return new Response(
          JSON.stringify({ 
            error: 'Not qualified',
            zillow_rating: license.zillow_rating,
            zillow_reviews: license.zillow_reviews,
            required: '4.8+ rating AND 20+ reviews'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if already exists in professionals by license_number
      const { data: existing } = await supabase
        .from('professionals')
        .select('id, name')
        .eq('license_number', license.license_number)
        .maybeSingle();

      if (existing) {
        console.log(`enrichment-api - Professional already exists for license ${license.license_number}: ${existing.id}`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            action: 'already_exists',
            professional_id: existing.id,
            name: existing.name
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get city_id from cities table based on license city name
      let cityId = null;
      if (license.city) {
        const { data: cityData } = await supabase
          .from('cities')
          .select('id')
          .ilike('name', license.city)
          .eq('state_slug', license.state?.toLowerCase() || 'arizona')
          .maybeSingle();
        
        cityId = cityData?.id;
      }

      // Get default category (Real Estate Agent)
      const { data: categoryData } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', 'top10realestateagents')
        .single();

      if (!categoryData) {
        console.error('enrichment-api - Default category not found');
        return new Response(
          JSON.stringify({ error: 'Default category not found' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If no city found, try to create or get a default
      if (!cityId) {
        // Try Phoenix as default for Arizona
        const { data: defaultCity } = await supabase
          .from('cities')
          .select('id')
          .eq('slug', 'phoenix')
          .single();
        
        cityId = defaultCity?.id;
      }

      if (!cityId) {
        console.error('enrichment-api - Could not determine city_id');
        return new Response(
          JSON.stringify({ error: 'Could not determine city for this license' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create the professional record
      const professionalData = {
        name: license.name,
        license_number: license.license_number,
        license_type: license.license_type,
        email: license.email,
        phone: license.phone,
        website: license.website,
        company: license.brokerage_name,
        zillow_profile_url: license.zillow_url,
        review_stars_rating: license.zillow_rating,
        num_total_reviews: license.zillow_reviews,
        years_experience: license.years_experience,
        city_id: cityId,
        category_id: categoryData.id,
        type: 'individual',
        rank: 999, // Will be recalculated
        active: true,
        zillow_data_fetched_at: new Date().toISOString()
      };

      const { data: newProfessional, error: insertError } = await supabase
        .from('professionals')
        .insert(professionalData)
        .select('id, name, short_code, profile_link')
        .single();

      if (insertError) {
        console.error('enrichment-api - Insert professional error:', insertError);
        return new Response(
          JSON.stringify({ error: insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`enrichment-api - Created professional ${newProfessional.id} from license ${license_id}`);

      // Trigger synthesis for the new professional
      let synthesisTriggerResult = null;
      try {
        const synthesisResponse = await fetch(`${supabaseUrl}/functions/v1/synthesize-agent-profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({ professional_id: newProfessional.id })
        });
        
        if (synthesisResponse.ok) {
          synthesisTriggerResult = 'triggered';
          console.log(`enrichment-api - Synthesis triggered for new professional ${newProfessional.id}`);
        } else {
          synthesisTriggerResult = `failed: ${synthesisResponse.status}`;
        }
      } catch (synthError) {
        synthesisTriggerResult = `error: ${synthError instanceof Error ? synthError.message : 'unknown'}`;
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          action: 'created',
          professional_id: newProfessional.id,
          name: newProfessional.name,
          short_code: newProfessional.short_code,
          profile_link: newProfessional.profile_link,
          synthesis: synthesisTriggerResult
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ NEW: POST action=upsert-cities ============
    if (req.method === 'POST' && action === 'upsert-cities') {
      const body = await req.json();
      const { cities } = body;

      if (!cities || !Array.isArray(cities) || cities.length === 0) {
        return new Response(
          JSON.stringify({ error: 'cities array is required and must not be empty' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`enrichment-api - Upserting ${cities.length} cities`);

      const results: { slug: string; success: boolean; action: string; error?: string }[] = [];
      let inserted = 0;
      let updated = 0;
      let failed = 0;

      for (const city of cities) {
        const { name, state, state_slug, slug, active, lat, lon } = city;

        if (!name || !state || !state_slug || !slug) {
          results.push({ slug: slug || 'unknown', success: false, action: 'skipped', error: 'Missing required fields (name, state, state_slug, slug)' });
          failed++;
          continue;
        }

        // Check if city exists
        const { data: existing, error: checkError } = await supabase
          .from('cities')
          .select('id')
          .eq('slug', slug)
          .eq('state_slug', state_slug)
          .maybeSingle();

        if (checkError) {
          results.push({ slug, success: false, action: 'error', error: checkError.message });
          failed++;
          continue;
        }

        if (existing) {
          // Update existing city - include lat/lon if provided
          const updateData: Record<string, unknown> = { 
            name, 
            state, 
            active: active ?? true, 
            updated_at: new Date().toISOString() 
          };
          if (lat !== undefined) updateData.lat = lat;
          if (lon !== undefined) updateData.lon = lon;

          const { error: updateError } = await supabase
            .from('cities')
            .update(updateData)
            .eq('id', existing.id);

          if (updateError) {
            results.push({ slug, success: false, action: 'update_failed', error: updateError.message });
            failed++;
          } else {
            results.push({ slug, success: true, action: 'updated' });
            updated++;
          }
        } else {
          // Insert new city - include lat/lon if provided
          const insertData: Record<string, unknown> = { 
            name, 
            state, 
            state_slug, 
            slug, 
            active: active ?? true 
          };
          if (lat !== undefined) insertData.lat = lat;
          if (lon !== undefined) insertData.lon = lon;

          const { error: insertError } = await supabase
            .from('cities')
            .insert(insertData);

          if (insertError) {
            results.push({ slug, success: false, action: 'insert_failed', error: insertError.message });
            failed++;
          } else {
            results.push({ slug, success: true, action: 'inserted' });
            inserted++;
          }
        }
      }

      console.log(`enrichment-api - Upsert cities complete: ${inserted} inserted, ${updated} updated, ${failed} failed`);

      return new Response(
        JSON.stringify({
          processed: cities.length,
          inserted,
          updated,
          failed,
          results
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ NEW: POST action=upsert-marketing-content ============
    if (req.method === 'POST' && action === 'upsert-marketing-content') {
      const body = await req.json();
      const { records } = body;

      if (!records || !Array.isArray(records) || records.length === 0) {
        return new Response(
          JSON.stringify({ error: 'records array is required and must not be empty' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`enrichment-api - Upserting ${records.length} marketing_content records`);

      let inserted = 0;
      let updated = 0;
      let failed = 0;
      const errors: { page: string; section: string; key: string; error: string }[] = [];

      for (const record of records) {
        const { page, section, key, type, value } = record;

        if (!page || !section || !key) {
          errors.push({ page: page || 'unknown', section: section || 'unknown', key: key || 'unknown', error: 'Missing required fields (page, section, key)' });
          failed++;
          continue;
        }

        // Check if record exists using page + section + key as composite key
        const { data: existing, error: checkError } = await supabase
          .from('marketing_content')
          .select('id')
          .eq('page', page)
          .eq('section', section)
          .eq('key', key)
          .maybeSingle();

        if (checkError) {
          errors.push({ page, section, key, error: checkError.message });
          failed++;
          continue;
        }

        if (existing) {
          // Update existing record
          const { error: updateError } = await supabase
            .from('marketing_content')
            .update({ 
              type: type || 'json', 
              value: typeof value === 'string' ? value : JSON.stringify(value),
              updated_at: new Date().toISOString() 
            })
            .eq('id', existing.id);

          if (updateError) {
            errors.push({ page, section, key, error: updateError.message });
            failed++;
          } else {
            updated++;
          }
        } else {
          // Insert new record
          const { error: insertError } = await supabase
            .from('marketing_content')
            .insert({ 
              page, 
              section, 
              key, 
              type: type || 'json', 
              value: typeof value === 'string' ? value : JSON.stringify(value)
            });

          if (insertError) {
            errors.push({ page, section, key, error: insertError.message });
            failed++;
          } else {
            inserted++;
          }
        }
      }

      console.log(`enrichment-api - Upsert marketing_content complete: ${inserted} inserted, ${updated} updated, ${failed} failed`);

      return new Response(
        JSON.stringify({
          processed: records.length,
          inserted,
          updated,
          failed,
          errors: errors.length > 0 ? errors : undefined
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // ============ NEW: POST action=update-neighborhood ============
    if (req.method === 'POST' && action === 'update-neighborhood') {
      const body = await req.json();
      const { id, ...fields } = body;
      
      if (!id) {
        return new Response(JSON.stringify({ error: 'id is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`enrichment-api - Updating neighborhood ${id}`);

      const { data, error } = await supabase
        .from('neighborhood_catalog')
        .update(fields)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // ============ NEW: POST action=recompute-nearby ============
    if (req.method === 'POST' && action === 'recompute-nearby') {
      const body = await req.json();
      const { id } = body;
      
      if (!id) {
        return new Response(JSON.stringify({ error: 'id is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`enrichment-api - Recomputing nearby neighborhoods for ${id}`);

      // Get the target neighborhood
      const { data: target, error: targetError } = await supabase
        .from('neighborhood_catalog')
        .select('id, lat, lon, city_area, state')
        .eq('id', id)
        .single();

      if (targetError || !target) {
        return new Response(JSON.stringify({ error: 'Neighborhood not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`enrichment-api - Target neighborhood: ${target.city_area}, ${target.state}`);

      // Get all active neighborhoods IN THE SAME STATE (allow adjacent cities)
      const { data: allNeighborhoods, error: allError } = await supabase
        .from('neighborhood_catalog')
        .select('id, neighborhood, neighborhood_slug, city_area, state, lat, lon, tier')
        .eq('is_active', true)
        .eq('state', target.state);

      if (allError) {
        return new Response(JSON.stringify({ error: allError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Haversine formula to calculate distance in miles
      const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 3959; // Earth's radius in miles
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
      };

      // Find nearby neighborhoods within 3 miles (same state, allows adjacent cities like Phoenix/Scottsdale)
      const nearby = (allNeighborhoods || [])
        .filter(n => n.id !== id && n.lat && n.lon)
        .map(n => ({
          id: n.id,
          slug: n.neighborhood_slug,
          name: n.neighborhood,
          tier: n.tier,
          city_area: n.city_area,
          distance_miles: Math.round(haversine(target.lat, target.lon, n.lat!, n.lon!) * 100) / 100
        }))
        .filter(n => n.distance_miles <= 3.0) // 3 miles to include adjacent cities
        .sort((a, b) => a.distance_miles - b.distance_miles)
        .slice(0, 8);

      // Store just the neighborhood names (not full objects) for cleaner data
      const nearbyNames = nearby.map(n => n.name);

      // Update the neighborhood
      const { error: updateError } = await supabase
        .from('neighborhood_catalog')
        .update({ nearby_neighborhoods: nearbyNames })
        .eq('id', id);

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`enrichment-api - Found ${nearby.length} nearby neighborhoods for ${id}`);

      return new Response(JSON.stringify({ 
        success: true, 
        neighborhood_id: id,
        nearby_count: nearby.length,
        nearby_neighborhoods: nearby
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    // Invalid action - show all available actions
    return new Response(
      JSON.stringify({ 
        error: 'Invalid action',
        usage: {
          // Inspection actions
          schema: 'GET ?action=schema - Get database schema for all known tables',
          'list-tables': 'GET ?action=list-tables - List all accessible tables',
          audit: 'GET ?action=audit - Get row counts and samples from key tables',
          // Fetch actions
          fetch: 'GET ?action=fetch&limit=100 - Fetch professionals needing Zillow enrichment',
          'fetch-unenriched': 'GET ?action=fetch-unenriched&limit=100 - Fetch professionals needing any enrichment',
          fetch_licenses: 'GET ?action=fetch_licenses&limit=100&state=AZ - Fetch licenses needing scrape',
          // Update actions
          update: 'POST ?action=update - Update professional (body: {professional_id, ...fields})',
          update_license: 'POST ?action=update_license - Update license with Zillow data',
          'bulk-update': 'POST ?action=bulk-update - Bulk update professionals (body: {updates: [{id, ...fields}, ...]})',
          // City management
          'upsert-cities': 'POST ?action=upsert-cities - Upsert cities (body: {cities: [{name, state, state_slug, slug, active}]})',
          // Marketing content
          'upsert-marketing-content': 'POST ?action=upsert-marketing-content - Upsert marketing content (body: {records: [{page, section, key, type, value}]})',
          // Neighborhood actions
          'update-neighborhood': 'POST ?action=update-neighborhood - Update single neighborhood (body: {id, ...fields})',
          'recompute-nearby': 'POST ?action=recompute-nearby - Recompute nearby neighborhoods for a single neighborhood (body: {id})',
          // Promotion
          promote_to_professional: 'POST ?action=promote_to_professional - Promote qualified license (body: {license_id})',
        }
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('enrichment-api - Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

