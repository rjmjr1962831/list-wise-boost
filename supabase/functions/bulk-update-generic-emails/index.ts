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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔍 Finding agents with generic emails...');

    // Find all active agents with generic emails
    const { data: agents, error: fetchError } = await supabase
      .from('professionals')
      .select('id, name, email, zillow_profile_url, city_id, category_id')
      .eq('active', true)
      .not('email', 'is', null)
      .not('zillow_profile_url', 'is', null);

    if (fetchError) {
      throw new Error(`Failed to fetch agents: ${fetchError.message}`);
    }

    // Filter for generic emails
    const agentsWithGenericEmails = agents?.filter(agent => isGenericEmail(agent.email)) || [];

    console.log(`📧 Found ${agentsWithGenericEmails.length} agents with generic emails`);

    const results = {
      total: agentsWithGenericEmails.length,
      processed: 0,
      updated: 0,
      failed: 0,
      agents: [] as any[]
    };

    // Process each agent
    for (const agent of agentsWithGenericEmails) {
      results.processed++;
      
      try {
        console.log(`\n🔄 Processing ${agent.name} (${agent.email})...`);
        
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
            newEmail: null,
            status: 'failed',
            error: enrichError.message
          });
          continue;
        }

        // Check if email was updated
        const { data: updatedAgent } = await supabase
          .from('professionals')
          .select('email')
          .eq('id', agent.id)
          .single();

        const newEmail = updatedAgent?.email;
        const wasUpdated = newEmail && newEmail !== agent.email && !isGenericEmail(newEmail);

        if (wasUpdated) {
          console.log(`✅ Updated ${agent.name}: ${agent.email} → ${newEmail}`);
          results.updated++;
          results.agents.push({
            name: agent.name,
            oldEmail: agent.email,
            newEmail: newEmail,
            status: 'updated'
          });
        } else {
          console.log(`⚠️ No personal email found for ${agent.name}`);
          results.agents.push({
            name: agent.name,
            oldEmail: agent.email,
            newEmail: newEmail || agent.email,
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
          newEmail: null,
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
