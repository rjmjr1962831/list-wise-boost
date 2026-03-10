// DEPRECATED — This edge function is no longer in active use. See docs/takeaways for context.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PIPEDRIVE_API_TOKEN = Deno.env.get('PIPEDRIVE_API_TOKEN');
const PIPEDRIVE_DOMAIN = Deno.env.get('PIPEDRIVE_DOMAIN');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get distinct professional IDs who have viewed their profile (all view-related events)
    const { data: events, error: eventsError } = await supabase
      .from('funnel_events')
      .select('professional_id')
      .in('event_name', [
        'profile_viewed', 
        'accuracy_review_viewed', 
        'accuracy_confirmed', 
        'profile_approved', 
        'pricing_viewed', 
        'profile_edit_viewed', 
        'funnel_started'
      ]);

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      throw eventsError;
    }

    // Get unique professional IDs
    const professionalIds = [...new Set((events || []).map(e => e.professional_id).filter(Boolean))];
    console.log(`Found ${professionalIds.length} unique professionals with profile views`);

    if (professionalIds.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No professionals found with profile views' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get their Pipedrive person IDs
    const { data: syncStates, error: syncError } = await supabase
      .from('pipedrive_sync_state')
      .select('professional_id, pipedrive_person_id')
      .in('professional_id', professionalIds)
      .not('pipedrive_person_id', 'is', null);

    if (syncError) {
      console.error('Error fetching sync states:', syncError);
      throw syncError;
    }

    // Get professional names
    const { data: professionals, error: profError } = await supabase
      .from('professionals')
      .select('id, name, email')
      .in('id', professionalIds);

    if (profError) {
      console.error('Error fetching professionals:', profError);
      throw profError;
    }

    // Build map of person IDs to names
    const profMap = new Map((professionals || []).map(p => [p.id, { name: p.name, email: p.email }]));
    
    const uniquePersonIds = new Map<number, { name: string; email: string }>();
    for (const state of syncStates || []) {
      if (state.pipedrive_person_id) {
        const info = profMap.get(state.professional_id) || { name: 'Unknown', email: '' };
        uniquePersonIds.set(state.pipedrive_person_id, info);
      }
    }

    console.log(`Found ${uniquePersonIds.size} unique Pipedrive persons to update to Hot`);

    const results: { personId: number; name: string; success: boolean; error?: string }[] = [];

    // Pipedrive Label IDs (verified 2026-01-18):
    // 14 = Customer (green)
    // 15 = Hot lead (red) - agent approved profile or high-intent engagement
    // 16 = Warm lead (yellow) - active professional, default
    // 17 = Cold lead (blue) - default Pipedrive state
    
    // Update each person's label to Hot (15)
    for (const [personId, info] of uniquePersonIds) {
      try {
        const response = await fetch(
          `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/persons/${personId}?api_token=${PIPEDRIVE_API_TOKEN}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              label_ids: [15] // Hot lead (red)
            })
          }
        );

        const data = await response.json();
        
        if (data.success) {
          console.log(`Updated ${info.name} (${personId}) to Hot`);
          results.push({ personId, name: info.name, success: true });
        } else {
          console.error(`Failed to update ${info.name}:`, data.error);
          results.push({ personId, name: info.name, success: false, error: data.error });
        }

        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err) {
        console.error(`Error updating ${info.name}:`, err);
        results.push({ personId, name: info.name, success: false, error: String(err) });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return new Response(JSON.stringify({
      success: true,
      message: `Updated ${successful} professionals to Hot label, ${failed} failed`,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
