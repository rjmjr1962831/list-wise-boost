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
  status: 'valid' | 'invalid' | 'catch_all' | 'unknown' | 'failed' | 'timeout' | 'rate_limited';
  safe_to_send?: boolean;
  email_quality_score?: number;
  reason?: string;
  error?: string;
  attempts?: number;
}

// Fetch with timeout wrapper
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Exponential backoff retry for Clearout API call
async function verifEmailWithRetry(
  email: string,
  clearoutApiKey: string,
  maxRetries: number = 3
): Promise<{ data: any, error: any, attempts: number }> {
  const delays = [2000, 4000, 8000]; // Exponential backoff delays
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Attempt ${attempt}/${maxRetries} for ${email}`);
      
      const response = await fetchWithTimeout(
        'https://api.clearout.io/v2/email_verify/instant',
        {
          method: 'POST',
          headers: {
            'Authorization': clearoutApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email,
            timeout: 10,
          }),
        },
        15000 // 15 second timeout
      );

      if (!response.ok) {
        const errorText = await response.text();
        
        // Check for rate limit
        if (response.status === 429 || errorText.includes('1030')) {
          console.warn(`⚠️ Rate limit hit for ${email}`);
          
          // Try to parse "try calling after" time
          const match = errorText.match(/try calling after (\d+)/);
          if (match) {
            const waitSeconds = parseInt(match[1], 10);
            console.log(`⏳ Waiting ${waitSeconds} seconds due to rate limit...`);
            await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
            continue; // Retry after waiting
          }
          
          throw new Error(`Rate limited: ${errorText}`);
        }
        
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return { data, error: null, attempts: attempt };
      
    } catch (error: any) {
      const isTimeout = error.name === 'AbortError' || error.message.includes('timeout');
      const isRateLimit = error.message.includes('Rate limited');
      
      console.error(`❌ Attempt ${attempt} for ${email}: ${error.message}`);
      
      if (attempt < maxRetries && (isTimeout || isRateLimit)) {
        const delay = delays[attempt - 1] || 8000;
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return { 
        data: null, 
        error: { 
          message: error.message,
          isTimeout,
          isRateLimit
        },
        attempts: attempt
      };
    }
  }
  
  return { 
    data: null, 
    error: { message: 'Max retries exceeded' },
    attempts: maxRetries
  };
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
    let timeouts = 0;
    let rateLimited = 0;

    // Process in batches of 10 with pauses
    const BATCH_SIZE = 10;
    const agentList = agents || [];
    
    for (let batchStart = 0; batchStart < agentList.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, agentList.length);
      const batch = agentList.slice(batchStart, batchEnd);
      
      console.log(`\n📦 Processing batch ${Math.floor(batchStart / BATCH_SIZE) + 1} (${batchStart + 1}-${batchEnd} of ${agentList.length})`);

      // Process each agent in the batch
      for (const agent of batch) {
        try {
          console.log(`Verifying email for ${agent.name}: ${agent.email}`);

          // Call with retry logic
          const { data, error, attempts } = await verifEmailWithRetry(agent.email, clearoutApiKey);

          if (error) {
            const status = error.isTimeout ? 'timeout' : error.isRateLimit ? 'rate_limited' : 'failed';
            
            results.push({
              id: agent.id,
              name: agent.name,
              email: agent.email,
              status,
              error: error.message,
              attempts
            });
            
            if (error.isTimeout) timeouts++;
            else if (error.isRateLimit) rateLimited++;
            else failed++;
            
            console.error(`❌ Failed to verify ${agent.email}: ${error.message}`);
            
            // Wait 1 second before next attempt
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }

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
            attempts
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

          // Wait 1 second between API calls
          await new Promise(resolve => setTimeout(resolve, 1000));

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
      
      // Pause between batches (except for the last batch)
      if (batchEnd < agentList.length) {
        console.log(`⏸️ Pausing 10 seconds before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 10000));
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
        timeouts,
        rateLimited,
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
