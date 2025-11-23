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

    const { csvData } = await req.json();

    if (!csvData) {
      throw new Error('No CSV data provided');
    }

    console.log('📞 Starting phone number restoration from CSV...');

    // Parse CSV (skip header row)
    const lines = csvData.trim().split('\n');
    const header = lines[0];
    const dataRows = lines.slice(1);

    console.log(`📊 Processing ${dataRows.length} CSV rows...`);

    const results = {
      total_rows: dataRows.length,
      agents_found: 0,
      phones_updated: 0,
      phones_skipped: 0,
      agents_not_found: [] as string[],
      updated_agents: [] as any[]
    };

    for (const row of dataRows) {
      // Parse CSV row (handle quoted values)
      const values = row.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)?.map((v: string) => v.replace(/^"|"$/g, '').trim()) || [];
      
      if (values.length < 3) continue;

      const [name, brokerage, city, state, rank, email, phone, website, rating, reviews] = values;

      // Skip if no phone number in CSV
      if (!phone || phone === '') {
        console.log(`⏭️  Skipping ${name} (${city}) - no phone in CSV`);
        results.phones_skipped++;
        continue;
      }

      // Find city in database
      const { data: cityData } = await supabase
        .from('cities')
        .select('id, name')
        .ilike('name', city)
        .eq('state', state || 'Arizona')
        .single();

      if (!cityData) {
        console.log(`⚠️  City not found: ${city}, ${state}`);
        results.agents_not_found.push(`${name} (${city})`);
        continue;
      }

      // Find agent by name and city
      const { data: agents } = await supabase
        .from('professionals')
        .select('id, name, phone, email, city_id')
        .eq('city_id', cityData.id)
        .ilike('name', name);

      if (!agents || agents.length === 0) {
        console.log(`⚠️  Agent not found: ${name} in ${city}`);
        results.agents_not_found.push(`${name} (${city})`);
        continue;
      }

      results.agents_found++;

      // Update phone for all matching agents (in case of multiple records)
      for (const agent of agents) {
        // Update ONLY the phone field - preserve email and all other data
        const { error: updateError } = await supabase
          .from('professionals')
          .update({ 
            phone: phone,
            updated_at: new Date().toISOString()
          })
          .eq('id', agent.id);

        if (updateError) {
          console.error(`❌ Failed to update ${name}:`, updateError);
          continue;
        }

        console.log(`✅ Updated phone for ${name} (${city}): ${phone}`);
        console.log(`   Email preserved: ${agent.email || 'N/A'}`);
        
        results.phones_updated++;
        results.updated_agents.push({
          name: agent.name,
          city: cityData.name,
          phone: phone,
          email_preserved: agent.email
        });
      }
    }

    console.log(`\n📊 Restoration Summary:`);
    console.log(`   Total CSV rows: ${results.total_rows}`);
    console.log(`   Agents found: ${results.agents_found}`);
    console.log(`   Phones updated: ${results.phones_updated}`);
    console.log(`   Phones skipped (no data): ${results.phones_skipped}`);
    console.log(`   Agents not found: ${results.agents_not_found.length}`);

    return new Response(
      JSON.stringify(results),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('❌ Phone restoration error:', error);
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
