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

// Global rate limit tracking
let lastRateLimitTime = 0;
const MIN_WAIT_AFTER_RATE_LIMIT = 10000; // Wait 10s after any rate limit

// Exponential backoff retry for Clearout API call
async function verifEmailWithRetry(
  email: string,
  clearoutApiKey: string,
  maxRetries: number = 3
): Promise<{ data: any, error: any, attempts: number }> {
  const delays = [3000, 8000, 15000]; // Longer delays for Clearout - 3s, 8s, 15s
  
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
            timeout: 30,
          }),
        },
        45000 // 45 second timeout
      );

      // Check for 524 Cloudflare timeout (server took too long)
      if (response.status === 524) {
        console.warn(`⚠️ 524 Timeout from Clearout for ${email} (attempt ${attempt})`);
        if (attempt < maxRetries) {
          const delay = delays[attempt - 1] * 2 || 10000; // Longer delays for 524
          console.log(`⏳ Waiting ${delay}ms before retry due to 524...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue; // Retry
        }
        return { 
          data: null, 
          error: { message: '524 Timeout - Clearout server overloaded', isTimeout: true, isRateLimit: false },
          attempts: attempt
        };
      }

      if (!response.ok) {
        const errorText = await response.text();
        
        // Check for rate limit
        if (response.status === 429 || errorText.includes('1030')) {
          console.warn(`⚠️ Rate limit hit for ${email}`);
          lastRateLimitTime = Date.now();
          
          // Try multiple patterns for rate limit wait time
          const patterns = [
            /try calling after (\d+)/i,           // "try calling after 30"
            /wait (\d+) seconds/i,                 // "wait 30 seconds"
            /retry after (\d+)/i,                  // "retry after 30"
            /(\d+)\s*seconds?/i                    // Generic "30 seconds"
          ];

          let waitSeconds = 30; // Default to 30 seconds if can't parse
          for (const pattern of patterns) {
            const match = errorText.match(pattern);
            if (match) {
              waitSeconds = parseInt(match[1], 10);
              break;
            }
          }

          console.log(`⏳ Rate limited - waiting ${waitSeconds} seconds...`);
          await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
          continue; // Retry after waiting
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
          // Accept both 'yes' and 'risky' as valid for sending
          const safeToSendValue = data.safe_to_send;
          const safeSend = safeToSendValue === 'yes' || safeToSendValue === 'risky';
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
                  safe_to_send: safeToSendValue,
                  quality_score: score,
                  verified_by: 'clearout',
                  verified_at: new Date().toISOString(),
                  full_response: data,
                },
              })
              .eq('id', agent.id);

            if (updateError) {
              console.error(`❌ Error updating ${agent.name}:`, updateError);
            } else {
              verified++;
              console.log(`✅ Verified: ${agent.email}`);
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
        const BATCH_PAUSE = 15000; // 15 seconds between batches
        
        // Extra wait if we hit a rate limit recently
        const timeSinceRateLimit = Date.now() - lastRateLimitTime;
        if (timeSinceRateLimit < MIN_WAIT_AFTER_RATE_LIMIT) {
          const extraWait = MIN_WAIT_AFTER_RATE_LIMIT - timeSinceRateLimit;
          console.log(`⏸️ Extra ${Math.round(extraWait/1000)}s wait due to recent rate limit`);
          await new Promise(resolve => setTimeout(resolve, extraWait));
        }
        
        console.log(`⏸️ Pausing 15 seconds before next batch...`);
        await new Promise(resolve => setTimeout(resolve, BATCH_PAUSE));
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
