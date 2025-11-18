import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RATE_LIMIT_THRESHOLD = 1500; // requests per 30 days
const WINDOW_DAYS = 30;

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get IP address from request
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';

    console.log('Rate limit check for IP:', clientIP);

    // Check if IP exists in rate_limits table
    const { data: existingRecord, error: fetchError } = await supabase
      .from('rate_limits')
      .select('*')
      .eq('ip_address', clientIP)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching rate limit:', fetchError);
      throw fetchError;
    }

    const now = new Date();
    const windowStart = existingRecord?.window_start ? new Date(existingRecord.window_start) : null;
    const daysSinceWindowStart = windowStart 
      ? (now.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24)
      : WINDOW_DAYS + 1;

    // If no record exists or window has expired, create/reset record
    if (!existingRecord || daysSinceWindowStart > WINDOW_DAYS) {
      const { error: upsertError } = await supabase
        .from('rate_limits')
        .upsert({
          ip_address: clientIP,
          request_count: 1,
          window_start: now.toISOString(),
        }, {
          onConflict: 'ip_address'
        });

      if (upsertError) {
        console.error('Error creating/resetting rate limit:', upsertError);
        throw upsertError;
      }

      console.log('New window started for IP:', clientIP);
      return new Response(
        JSON.stringify({ 
          allowed: true, 
          requestCount: 1, 
          limit: RATE_LIMIT_THRESHOLD,
          remaining: RATE_LIMIT_THRESHOLD - 1
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if limit exceeded
    if (existingRecord.request_count >= RATE_LIMIT_THRESHOLD) {
      const daysRemaining = Math.ceil(WINDOW_DAYS - daysSinceWindowStart);
      console.log('Rate limit exceeded for IP:', clientIP);
      
      return new Response(
        JSON.stringify({ 
          allowed: false, 
          requestCount: existingRecord.request_count,
          limit: RATE_LIMIT_THRESHOLD,
          remaining: 0,
          resetInDays: daysRemaining,
          message: `Rate limit exceeded. You've made ${existingRecord.request_count} requests in the last 30 days. Limit resets in ${daysRemaining} day(s).`
        }),
        { 
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Increment counter
    const newCount = existingRecord.request_count + 1;
    const { error: updateError } = await supabase
      .from('rate_limits')
      .update({ request_count: newCount })
      .eq('ip_address', clientIP);

    if (updateError) {
      console.error('Error updating rate limit:', updateError);
      throw updateError;
    }

    console.log(`Request ${newCount}/${RATE_LIMIT_THRESHOLD} for IP:`, clientIP);

    return new Response(
      JSON.stringify({ 
        allowed: true, 
        requestCount: newCount,
        limit: RATE_LIMIT_THRESHOLD,
        remaining: RATE_LIMIT_THRESHOLD - newCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Rate limit check error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // On error, allow the request (fail open)
    return new Response(
      JSON.stringify({ 
        allowed: true, 
        error: 'Rate limit check failed, allowing request',
        details: errorMessage
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});