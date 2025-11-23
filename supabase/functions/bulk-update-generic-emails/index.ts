import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const genericPrefixes = ['info@', 'contact@', 'hello@', 'support@', 'sales@', 'admin@', 'office@', 'team@'];

const isGenericEmail = (email: string | null): boolean => {
  if (!email) return false;
  const lower = email.toLowerCase();
  return genericPrefixes.some(prefix => lower.startsWith(prefix));
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limit } = await req.json();
    const maxAgents = limit || 5; // Default to 5 for testing
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`🔍 Finding agents with generic emails or missing phone numbers (limit: ${maxAgents})...`);

    // Find all active agents with Zillow profiles
    const { data: agents, error: fetchError } = await supabase
      .from('professionals')
      .select('id, name, email, phone, zillow_profile_url, city_id, category_id')
      .eq('active', true)
      .not('zillow_profile_url', 'is', null);

    if (fetchError) {
      throw new Error(`Failed to fetch agents: ${fetchError.message}`);
    }

    // Filter for agents needing enrichment (generic email OR missing phone)
    let agentsNeedingEnrichment = agents?.filter(agent => 
      isGenericEmail(agent.email) || !agent.phone || agent.phone.trim() === ''
    ) || [];

    console.log(`📧 Found ${agentsNeedingEnrichment.length} agents needing enrichment (generic emails or missing phones)`);
    
    // Limit the number of agents to process
    if (agentsNeedingEnrichment.length > maxAgents) {
      console.log(`⚠️ Limiting to first ${maxAgents} agents for this run`);
      agentsNeedingEnrichment = agentsNeedingEnrichment.slice(0, maxAgents);
    }

    const results = {
      total: agentsNeedingEnrichment.length,
      processed: 0,
      updated: 0,
      failed: 0,
      agents: [] as any[]
    };

    // Process each agent
    for (const agent of agentsNeedingEnrichment) {
      results.processed++;
      
      try {
        const reasons = [];
        if (isGenericEmail(agent.email)) reasons.push('generic email');
        if (!agent.phone || agent.phone.trim() === '') reasons.push('missing phone');
        
        console.log(`\n🔄 Processing ${agent.name} (${reasons.join(', ')})...`);
        
        // Call fetch-single-memo23-agent to re-enrich
        const { data: enrichData, error: enrichError } = await supabase.functions.invoke(
          'fetch-single-memo23-agent',
          {
            body: { professionalId: agent.id }
          }
        );

        if (enrichError) {
          console.error(`❌ Failed to enrich ${agent.name}:`, enrichError);
          results.failed++;
          results.agents.push({
            name: agent.name,
            oldEmail: agent.email,
            oldPhone: agent.phone,
            newEmail: null,
            newPhone: null,
            status: 'failed',
            error: enrichError.message
          });
          continue;
        }

        // Check if email or phone was updated
        const { data: updatedAgent } = await supabase
          .from('professionals')
          .select('email, phone')
          .eq('id', agent.id)
          .single();

        const newEmail = updatedAgent?.email;
        const newPhone = updatedAgent?.phone;
        const emailUpdated = newEmail && newEmail !== agent.email && !isGenericEmail(newEmail);
        const phoneUpdated = newPhone && newPhone !== agent.phone && newPhone.trim() !== '';

        if (emailUpdated || phoneUpdated) {
          const changes = [];
          if (emailUpdated) changes.push(`email: ${agent.email} → ${newEmail}`);
          if (phoneUpdated) changes.push(`phone: ${agent.phone || 'missing'} → ${newPhone}`);
          console.log(`✅ Updated ${agent.name}: ${changes.join(', ')}`);
          results.updated++;
          results.agents.push({
            name: agent.name,
            oldEmail: agent.email,
            oldPhone: agent.phone,
            newEmail: newEmail,
            newPhone: newPhone,
            status: 'updated'
          });
        } else {
          console.log(`⚠️ No improvements found for ${agent.name}`);
          results.agents.push({
            name: agent.name,
            oldEmail: agent.email,
            oldPhone: agent.phone,
            newEmail: newEmail || agent.email,
            newPhone: newPhone || agent.phone,
            status: 'unchanged'
          });
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error: any) {
        console.error(`❌ Error processing ${agent.name}:`, error);
        results.failed++;
        results.agents.push({
          name: agent.name,
          oldEmail: agent.email,
          oldPhone: agent.phone,
          newEmail: null,
          newPhone: null,
          status: 'error',
          error: error.message
        });
      }
    }

    console.log('\n📊 Bulk update completed:', results);

    return new Response(
      JSON.stringify(results),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('❌ Bulk update error:', error);
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
