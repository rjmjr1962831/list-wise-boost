import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerificationResult {
  id: string;
  name: string;
  email: string;
  status: 'valid' | 'invalid' | 'catch_all' | 'unknown' | 'failed';
  safe_to_send?: boolean;
  email_quality_score?: number;
  reason?: string;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limit = 20, skipGeneric = true, citySlug } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const clearoutApiKey = Deno.env.get('CLEAROUT_API_KEY');
    
    if (!clearoutApiKey) {
      throw new Error('CLEAROUT_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build query for unverified agents
    let query = supabase
      .from('professionals')
      .select('id, name, email, city_id, cities(slug)')
      .eq('active', true)
      .not('email', 'is', null)
      .is('email_verified_at', null);

    // Skip generic emails if requested
    if (skipGeneric) {
      const genericPrefixes = ['info@', 'contact@', 'hello@', 'admin@', 'support@', 'sales@'];
      genericPrefixes.forEach(prefix => {
        query = query.not('email', 'ilike', `${prefix}%`);
      });
    }

    // Filter by city if provided
    if (citySlug) {
      const { data: city } = await supabase
        .from('cities')
        .select('id')
        .eq('slug', citySlug)
        .single();
      
      if (city) {
        query = query.eq('city_id', city.id);
      }
    }

    // Apply limit
    if (limit && limit > 0) {
      query = query.limit(limit);
    }

    const { data: agents, error: fetchError } = await query;

    if (fetchError) throw fetchError;

    console.log(`Found ${agents?.length || 0} agents to verify`);

    const results: VerificationResult[] = [];
    let verified = 0;
    let invalid = 0;
    let unknown = 0;
    let failed = 0;

    // Process each agent
    for (const agent of agents || []) {
      try {
        console.log(`Verifying email for ${agent.name}: ${agent.email}`);

        // Call Clearout Instant Verify API
        const response = await fetch('https://api.clearout.io/v2/email_verify/instant', {
          method: 'POST',
          headers: {
            'Authorization': clearoutApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: agent.email,
            timeout: 10, // 10 second timeout
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Clearout API error for ${agent.email}:`, errorText);
          results.push({
            id: agent.id,
            name: agent.name,
            email: agent.email,
            status: 'failed',
            error: `API error: ${response.status}`,
          });
          failed++;
          continue;
        }

        const data = await response.json();
        console.log(`Clearout response for ${agent.email}:`, data);

        const status = data.status?.toLowerCase() || 'unknown';
        const safeSend = data.safe_to_send === true;
        const score = data.email_quality_score;

        results.push({
          id: agent.id,
          name: agent.name,
          email: agent.email,
          status,
          safe_to_send: safeSend,
          email_quality_score: score,
          reason: data.reason,
        });

        // Update database if email is valid
        if (status === 'valid' && safeSend) {
          const { error: updateError } = await supabase
            .from('professionals')
            .update({
              email_verified_at: new Date().toISOString(),
              email_verification_data: {
                status,
                safe_to_send: safeSend,
                quality_score: score,
                verified_by: 'clearout',
                verified_at: new Date().toISOString(),
                full_response: data,
              },
            })
            .eq('id', agent.id);

          if (updateError) {
            console.error(`Error updating ${agent.name}:`, updateError);
          } else {
            verified++;
            console.log(`✓ Verified: ${agent.email}`);
          }
        } else if (status === 'invalid') {
          invalid++;
        } else {
          unknown++;
        }

        // Rate limiting: wait 500ms between API calls
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error: any) {
        console.error(`Error verifying ${agent.name}:`, error);
        results.push({
          id: agent.id,
          name: agent.name,
          email: agent.email,
          status: 'failed',
          error: error.message,
        });
        failed++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: agents?.length || 0,
        verified,
        invalid,
        unknown,
        failed,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in verify-emails-clearout:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
