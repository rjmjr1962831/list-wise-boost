import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OutscraperRequest {
  profileUrl: string;
}

function toInt(value: unknown): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const m = value.toString().replace(/[^0-9]/g, '');
  return m ? parseInt(m, 10) : 0;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileUrl }: OutscraperRequest = await req.json();
    if (!profileUrl) throw new Error('profileUrl is required');

    const apiKey = Deno.env.get('OUTSCRAPER_API_KEY');
    if (!apiKey) throw new Error('OUTSCRAPER_API_KEY not configured');

    // Direct Zillow-specific endpoint (no polling)
    const resp = await fetch('https://api.app.outscraper.com/zillow/agents', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        urls: [profileUrl],
        extract_reviews: false,
        reviews_limit: 0,
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error('Outscraper /zillow/agents error:', resp.status, t);
      return new Response(
        JSON.stringify({ success: false, error: `Outscraper error ${resp.status}`, details: t }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = await resp.json();
    const items: any[] = Array.isArray(payload) ? payload : (payload?.data ?? []);

    if (!items.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'No data returned from Outscraper', stats: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to pick the item that matches our URL
    const norm = (u: string) => u?.replace(/\/$/, '').toLowerCase();
    const target = norm(profileUrl);
    let agent = items.find((it) => norm(it.link || it.url || it.profile_url || '') === target) || items[0];

    const stats = {
      forSale: toInt(agent.listings_count ?? agent.current_listings ?? agent.for_sale),
      sold: toInt(agent.sales_count ?? agent.total_sales ?? agent.sold_total),
      forRent: 0,
      reviews: toInt(agent.reviews ?? agent.reviews_count ?? agent.total_reviews),
      currentListings: toInt(agent.listings_count ?? agent.current_listings),
      totalSales: toInt(agent.sales_count ?? agent.total_sales ?? agent.sold_total),
      yearsExperience: toInt(agent.years_experience ?? agent.experience_years),
    };

    return new Response(
      JSON.stringify({ success: true, stats, source: 'outscraper', rawData: agent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fetch-outscraper-agent-stats:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error', stats: null }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
