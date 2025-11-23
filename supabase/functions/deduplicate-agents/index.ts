import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔍 Finding duplicate real estate agents by zuid or zillow_profile_url...');

    // Get real estate category ID
    const { data: reCategory, error: catError } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', 'top10realestateagents')
      .single();

    if (catError) {
      throw new Error(`Failed to fetch category: ${catError.message}`);
    }

    // Find all real estate agents with zuid OR zillow_profile_url
    const { data: allAgents, error: fetchError } = await supabase
      .from('professionals')
      .select('*')
      .eq('active', true)
      .eq('category_id', reCategory.id)
      .or('zuid.not.is.null,zillow_profile_url.not.is.null');

    if (fetchError) {
      throw new Error(`Failed to fetch agents: ${fetchError.message}`);
    }

    // Group by unique identifier: normalize zillow_profile_url and use zuid as fallback
    const identifierGroups = new Map<string, any[]>();
    
    allAgents?.forEach(agent => {
      // Create unique identifier: use normalized zillow URL or zuid
      let identifier = '';
      
      if (agent.zillow_profile_url) {
        // Normalize zillow URL: remove protocol, trailing slashes, convert to lowercase
        identifier = agent.zillow_profile_url
          .toLowerCase()
          .replace(/^https?:\/\//, '')
          .replace(/\/$/, '');
      } else if (agent.zuid) {
        identifier = `zuid:${agent.zuid}`;
      }
      
      if (identifier) {
        const existing = identifierGroups.get(identifier) || [];
        existing.push(agent);
        identifierGroups.set(identifier, existing);
      }
    });

    // Filter to only groups with duplicates
    const duplicates = Array.from(identifierGroups.entries())
      .filter(([_, agents]) => agents.length > 1);

    console.log(`📊 Found ${duplicates.length} agent groups with duplicates`);

    const results = {
      total_groups: 0,
      total_duplicates_removed: 0,
      groups: [] as any[]
    };

    // Process each duplicate group
    for (const [identifier, agents] of duplicates) {
      console.log(`\n👥 Processing ${identifier} - ${agents[0]?.name} (${agents.length} duplicates)...`);

      // Sort by: 1) has zillow_profile_url, 2) most recent update, 3) highest rating
      const sorted = agents.sort((a, b) => {
        if (a.zillow_profile_url && !b.zillow_profile_url) return -1;
        if (!a.zillow_profile_url && b.zillow_profile_url) return 1;
        if (a.updated_at > b.updated_at) return -1;
        if (a.updated_at < b.updated_at) return 1;
        return (b.review_stars_rating || 0) - (a.review_stars_rating || 0);
      });

      // Keep the best record
      const keepRecord = sorted[0];
      const duplicatesToRemove = sorted.slice(1);

      // Merge ALL data fields: collect non-null values from all duplicates
      const mergedData: any = { ...keepRecord };

      // Data fields to merge (prioritize non-null/non-empty values)
      const stringFields = ['email', 'phone', 'website', 'address', 'business_name', 'company', 
                           'license_number', 'title', 'description', 'get_to_know_me'];
      const jsonFields = ['specialty', 'badges', 'professional_information', 'agent_sales_stats',
                         'agent_licenses', 'reviews_data', 'past_sales', 'business_address',
                         'phone_numbers', 'profile_types', 'ratings', 'professional_data', 
                         'team_display_information'];
      const numberFields = ['years_experience', 'total_sales', 'current_listings', 'num_total_reviews'];

      // Merge string fields
      for (const field of stringFields) {
        for (const dup of duplicatesToRemove) {
          if (!mergedData[field] && dup[field]) {
            mergedData[field] = dup[field];
          }
        }
      }

      // Merge number fields (take highest value)
      for (const field of numberFields) {
        for (const dup of duplicatesToRemove) {
          if (dup[field] && (!mergedData[field] || dup[field] > mergedData[field])) {
            mergedData[field] = dup[field];
          }
        }
      }

      // Merge JSON/array fields (combine data)
      for (const field of jsonFields) {
        if (Array.isArray(mergedData[field])) {
          // Merge arrays
          for (const dup of duplicatesToRemove) {
            if (Array.isArray(dup[field]) && dup[field].length > 0) {
              mergedData[field] = [...new Set([...mergedData[field], ...dup[field]])];
            }
          }
        } else if (mergedData[field] && typeof mergedData[field] === 'object') {
          // Merge objects
          for (const dup of duplicatesToRemove) {
            if (dup[field] && typeof dup[field] === 'object') {
              mergedData[field] = { ...mergedData[field], ...dup[field] };
            }
          }
        } else {
          // Use first non-null value
          for (const dup of duplicatesToRemove) {
            if (!mergedData[field] && dup[field]) {
              mergedData[field] = dup[field];
            }
          }
        }
      }

      // Take highest rating
      for (const dup of duplicatesToRemove) {
        if (dup.review_stars_rating && (!mergedData.review_stars_rating || dup.review_stars_rating > mergedData.review_stars_rating)) {
          mergedData.review_stars_rating = dup.review_stars_rating;
        }
      }

      // Update the kept record with merged data
      const { error: updateError } = await supabase
        .from('professionals')
        .update(mergedData)
        .eq('id', keepRecord.id);

      if (updateError) {
        console.error(`❌ Failed to update ${name}:`, updateError);
        continue;
      }

      // Delete duplicates
      const duplicateIds = duplicatesToRemove.map(d => d.id);
      const { error: deleteError } = await supabase
        .from('professionals')
        .delete()
        .in('id', duplicateIds);

      if (deleteError) {
        console.error(`❌ Failed to delete duplicates for ${name}:`, deleteError);
        continue;
      }

      console.log(`✅ Merged ${identifier}: kept ${keepRecord.id}, removed ${duplicateIds.length} duplicates`);
      console.log(`   Name: ${keepRecord.name}, Email: ${mergedData.email}, Phone: ${mergedData.phone}`);

      results.total_groups++;
      results.total_duplicates_removed += duplicateIds.length;
      results.groups.push({
        name: keepRecord.name,
        count: agents.length,
        records: agents.map(a => ({
          id: a.id,
          email: a.email,
          phone: a.phone,
          website: a.website,
          review_stars_rating: a.review_stars_rating
        })),
        merged: {
          email: mergedData.email,
          phone: mergedData.phone,
          website: mergedData.website,
          kept_id: keepRecord.id
        }
      });
    }

    console.log(`\n✅ Deduplication complete: ${results.total_groups} groups, ${results.total_duplicates_removed} duplicates removed`);

    return new Response(
      JSON.stringify(results),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('❌ Deduplication error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
