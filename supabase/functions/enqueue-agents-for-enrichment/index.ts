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
    const { 
      citySlug, 
      cityId, 
      stateSlug,
      minRating = 4.5,
      requireMissingData = true,  // Only queue agents missing email/phone
      limit = 500
    } = await req.json().catch(() => ({}));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`🔍 Finding agents needing enrichment (minRating: ${minRating})...`);

    // Build query for active agents with Zillow profiles
    let query = supabase
      .from('professionals')
      .select('id, name, email, phone, review_stars_rating, city_id')
      .eq('active', true)
      .gte('review_stars_rating', minRating)
      .not('zillow_profile_url', 'is', null);

    // Filter by city if specified
    if (cityId) {
      query = query.eq('city_id', cityId);
    } else if (citySlug) {
      const { data: city } = await supabase
        .from('cities')
        .select('id')
        .eq('slug', citySlug)
        .single();
      if (city) {
        query = query.eq('city_id', city.id);
      }
    } else if (stateSlug) {
      // Filter by state (e.g., 'texas' or 'tx')
      const { data: cities } = await supabase
        .from('cities')
        .select('id')
        .or(`state_slug.eq.${stateSlug},state_slug.eq.${stateSlug.toLowerCase()}`);
      if (cities && cities.length > 0) {
        const cityIds = cities.map(c => c.id);
        query = query.in('city_id', cityIds);
      }
    }

    query = query.limit(limit);

    const { data: agents, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch agents: ${fetchError.message}`);
    }

    // Filter for agents needing enrichment (optional)
    let agentsNeedingEnrichment = agents || [];
    if (requireMissingData) {
      agentsNeedingEnrichment = agents?.filter(agent => {
        const hasGenericEmail = isGenericEmail(agent.email);
        const missingPhone = !agent.phone || agent.phone.trim() === '';
        return hasGenericEmail || missingPhone;
      }) || [];
    }

    console.log(`📧 Found ${agentsNeedingEnrichment.length} agents needing enrichment`);

    // Check which agents are already in queue (any status - unique constraint)
    const agentIds = agentsNeedingEnrichment.map(a => a.id);
    const { data: existingQueue } = await supabase
      .from('contact_enrichment_queue')
      .select('professional_id')
      .in('professional_id', agentIds);

    const existingIds = new Set(existingQueue?.map(q => q.professional_id) || []);

    // Add new agents to queue
    const queueItems = agentsNeedingEnrichment
      .filter(agent => !existingIds.has(agent.id))
      .map(agent => {
        const hasGenericEmail = isGenericEmail(agent.email);
        const missingPhone = !agent.phone || agent.phone.trim() === '';
        let reason = '';
        if (hasGenericEmail && missingPhone) reason = 'both';
        else if (hasGenericEmail) reason = 'generic_email';
        else reason = 'missing_phone';

        return {
          professional_id: agent.id,
          reason,
          status: 'pending'
        };
      });

    if (queueItems.length === 0) {
      console.log('✅ All agents already in queue or processed');
      return new Response(
        JSON.stringify({ 
          message: 'All agents already in queue',
          total: agentsNeedingEnrichment.length,
          queued: 0,
          existing: existingIds.size
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert into queue
    const { error: insertError } = await supabase
      .from('contact_enrichment_queue')
      .insert(queueItems);

    if (insertError) {
      throw new Error(`Failed to insert queue items: ${insertError.message}`);
    }

    console.log(`✅ Added ${queueItems.length} agents to queue`);

    return new Response(
      JSON.stringify({ 
        message: 'Agents added to queue',
        total: agentsNeedingEnrichment.length,
        queued: queueItems.length,
        existing: existingIds.size
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Enqueue error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
