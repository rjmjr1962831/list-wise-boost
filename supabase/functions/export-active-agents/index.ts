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

    // Parse optional parameters
    let format: 'json' | 'csv' = 'json';
    let filter: 'active' | 'qualified' | 'pipedrive_ready' = 'qualified';

    try {
      const body = await req.json();
      if (body?.format === 'csv') format = 'csv';
      if (body?.filter === 'active' || body?.filter === 'qualified' || body?.filter === 'pipedrive_ready') {
        filter = body.filter;
      }
    } catch {
      // No body or invalid JSON, use defaults
    }

    console.log(`Exporting agents, filter: ${filter}, format: ${format}`);

    // Query professionals table for agents across all states
    // Use pagination to get ALL results (Supabase default limit is 1000)
    const allData: any[] = [];
    const pageSize = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('professionals')
        .select('name, zuid, zillow_profile_url, state_slug, review_stars_rating, num_total_reviews')
        .eq('active', true);

      if (filter !== 'active') {
        query = query.gte('review_stars_rating', 4.8).gte('num_total_reviews', 20);
      }

      if (filter === 'pipedrive_ready') {
        query = query
          .not('email', 'is', null)
          .neq('email', '')
          .not('synthesized_bio', 'is', null);
      }

      const { data, error } = await query
        .order('name', { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error('Database query error:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      if (data && data.length > 0) {
        allData.push(...data);
        console.log(`Fetched ${data.length} agents (total: ${allData.length})`);
        offset += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    console.log(`Found ${allData.length} agents for filter: ${filter}`);

    // Split name into first_name and last_name for the export format requested
    const formattedData = allData.map((agent: any) => {
      const nameParts = agent.name?.split(' ') || [];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      return {
        first_name: firstName,
        last_name: lastName,
        zillow_uid: agent.zuid,
        zillow_url: agent.zillow_profile_url,
        state: agent.state_slug,
        rating: agent.review_stars_rating,
        reviews: agent.num_total_reviews
      };
    });

    // Sort by last_name, then first_name
    formattedData.sort((a: any, b: any) => {
      const lastNameCompare = (a.last_name || '').localeCompare(b.last_name || '');
      if (lastNameCompare !== 0) return lastNameCompare;
      return (a.first_name || '').localeCompare(b.first_name || '');
    });

    // Generate filename with today's date
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    if (format === 'csv') {
      // CSV format
      const headers = ['first_name', 'last_name', 'zillow_uid', 'zillow_url', 'state', 'rating', 'reviews'];
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
          'Content-Disposition': `attachment; filename="agents_${filter}_${today}.csv"`,
        },
      });
    }

    // Default: JSON format
    const jsonContent = JSON.stringify(
      {
        exported_at: new Date().toISOString(),
        filter,
        total_count: formattedData.length,
        agents: formattedData,
      },
      null,
      2,
    );

    return new Response(jsonContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="agents_${filter}_${today}.json"`,
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
