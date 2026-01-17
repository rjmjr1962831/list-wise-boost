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

    console.log('Fetching active agents with websites...');

    // Fetch all active agents with websites in batches
    const allAgents: any[] = [];
    let offset = 0;
    const batchSize = 1000;
    
    while (true) {
      const { data, error } = await supabase
        .from('professionals')
        .select('name, website, phone')
        .eq('active', true)
        .not('website', 'is', null)
        .neq('website', '')
        .range(offset, offset + batchSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;
      
      allAgents.push(...data);
      console.log(`Fetched ${allAgents.length} agents so far...`);
      
      if (data.length < batchSize) break;
      offset += batchSize;
    }

    console.log(`Total agents found: ${allAgents.length}`);

    // Parse names and build CSV
    const rows = allAgents.map(agent => {
      const nameParts = (agent.name || '').trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      const website = agent.website || '';
      const phone = agent.phone || '';
      
      return { firstName, lastName, website, phone };
    });

    // Sort by last name, then first name
    rows.sort((a, b) => {
      const lastCompare = a.lastName.localeCompare(b.lastName);
      if (lastCompare !== 0) return lastCompare;
      return a.firstName.localeCompare(b.firstName);
    });

    // Build CSV
    const escapeCSV = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    let csv = 'first_name,last_name,website,phone\n';
    for (const row of rows) {
      csv += `${escapeCSV(row.firstName)},${escapeCSV(row.lastName)},${escapeCSV(row.website)},${escapeCSV(row.phone)}\n`;
    }

    const date = new Date().toISOString().split('T')[0];
    const filename = `active_agents_${date}.csv`;

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
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
