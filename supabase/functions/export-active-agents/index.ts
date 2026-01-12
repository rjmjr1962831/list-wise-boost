import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse optional format parameter
    let format = 'json';
    try {
      const body = await req.json();
      format = body.format || 'json';
    } catch {
      // No body or invalid JSON, use default format
    }

    console.log(`Exporting active agents with Zillow UIDs, format: ${format}`);

    // Query professionals table for active agents with Zillow UIDs
    const { data, error } = await supabase
      .from('professionals')
      .select('name, zuid, zillow_profile_url')
      .eq('active', true)
      .not('zuid', 'is', null)
      .order('name', { ascending: true });

    if (error) {
      console.error('Database query error:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    console.log(`Found ${data?.length || 0} active agents with Zillow UIDs`);

    // Split name into first_name and last_name for the export format requested
    const formattedData = (data || []).map(agent => {
      const nameParts = agent.name?.split(' ') || [];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      return {
        first_name: firstName,
        last_name: lastName,
        zillow_uid: agent.zuid,
        zillow_url: agent.zillow_profile_url
      };
    });

    // Sort by last_name, then first_name
    formattedData.sort((a, b) => {
      const lastNameCompare = (a.last_name || '').localeCompare(b.last_name || '');
      if (lastNameCompare !== 0) return lastNameCompare;
      return (a.first_name || '').localeCompare(b.first_name || '');
    });

    // Generate filename with today's date
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    if (format === 'csv') {
      // CSV format
      const headers = ['first_name', 'last_name', 'zillow_uid', 'zillow_url'];
      const csvRows = [headers.join(',')];
      
      for (const row of formattedData) {
        const values = headers.map(header => {
          const value = row[header as keyof typeof row] || '';
          // Escape quotes and wrap in quotes if contains comma
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        });
        csvRows.push(values.join(','));
      }
      
      const csvContent = csvRows.join('\n');
      
      return new Response(csvContent, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="active_agents_${today}.csv"`,
        },
      });
    }

    // Default: JSON format
    const jsonContent = JSON.stringify({
      exported_at: new Date().toISOString(),
      total_count: formattedData.length,
      agents: formattedData
    }, null, 2);

    return new Response(jsonContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="active_agents_${today}.json"`,
      },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in export-active-agents:', errorMessage);
    return new Response(JSON.stringify({ 
      error: errorMessage,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
