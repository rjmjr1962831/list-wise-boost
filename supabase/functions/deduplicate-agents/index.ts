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

    console.log('🔍 Finding duplicate agents...');

    // Find all agents grouped by name with duplicates
    const { data: duplicateGroups, error: fetchError } = await supabase
      .from('professionals')
      .select('name, id, email, phone, website, review_stars_rating, updated_at, zillow_profile_url, active')
      .eq('active', true);

    if (fetchError) {
      throw new Error(`Failed to fetch agents: ${fetchError.message}`);
    }

    // Group by name
    const nameGroups = new Map<string, any[]>();
    duplicateGroups?.forEach(agent => {
      const existing = nameGroups.get(agent.name) || [];
      existing.push(agent);
      nameGroups.set(agent.name, existing);
    });

    // Filter to only groups with duplicates
    const duplicates = Array.from(nameGroups.entries())
      .filter(([_, agents]) => agents.length > 1);

    console.log(`📊 Found ${duplicates.length} agent groups with duplicates`);

    const results = {
      total_groups: 0,
      total_duplicates_removed: 0,
      groups: [] as any[]
    };

    // Process each duplicate group
    for (const [name, agents] of duplicates) {
      console.log(`\n👥 Processing ${name} (${agents.length} duplicates)...`);

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

      // Merge data: collect all non-null values from duplicates
      const mergedData: any = {
        email: keepRecord.email,
        phone: keepRecord.phone,
        website: keepRecord.website
      };

      // Fill in missing data from duplicates
      for (const dup of duplicatesToRemove) {
        if (!mergedData.email && dup.email) mergedData.email = dup.email;
        if (!mergedData.phone && dup.phone) mergedData.phone = dup.phone;
        if (!mergedData.website && dup.website) mergedData.website = dup.website;
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

      console.log(`✅ Merged ${name}: kept ${keepRecord.id}, removed ${duplicateIds.length} duplicates`);
      console.log(`   Data: email=${mergedData.email}, phone=${mergedData.phone}, website=${mergedData.website}`);

      results.total_groups++;
      results.total_duplicates_removed += duplicateIds.length;
      results.groups.push({
        name,
        count: agents.length,
        records: agents,
        merged: {
          ...mergedData,
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
