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

    const allAgents: any[] = [];
    let offset = 0;
    const batchSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('professionals')
        .select('name, email, zillow_profile_url')
        .eq('active', true)
        .not('email', 'is', null)
        .neq('email', '')
        .range(offset, offset + batchSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allAgents.push(...data);
      if (data.length < batchSize) break;
      offset += batchSize;
    }

    console.log(`Total agents with emails: ${allAgents.length}`);

    const escapeCSV = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    // Sort by name
    allAgents.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    let csv = 'name,email,zillow_profile_url\n';
    for (const agent of allAgents) {
      csv += `${escapeCSV(agent.name || '')},${escapeCSV(agent.email || '')},${escapeCSV(agent.zillow_profile_url || '')}\n`;
    }

    const date = new Date().toISOString().split('T')[0];

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="agents_email_zillow_${date}.csv"`,
      },
    });
  } catch (error: unknown) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
