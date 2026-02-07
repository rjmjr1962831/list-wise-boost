import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-enrichment-key',
};

const INSTANTLY_API_URL = "https://api.instantly.ai/api/v2";

function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = req.headers.get('x-enrichment-key');
    const expectedKey = Deno.env.get('ENRICHMENT_API_KEY');
    if (!apiKey || apiKey !== expectedKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const instantlyKey = Deno.env.get('INSTANTLY_API_KEY');
    if (!instantlyKey) {
      return new Response(JSON.stringify({ error: 'INSTANTLY_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (action === 'status') {
      const listRes = await fetch(`${INSTANTLY_API_URL}/lead-lists?limit=100`, {
        headers: { Authorization: `Bearer ${instantlyKey}` },
      });
      const lists = await listRes.json();
      const campRes = await fetch(`${INSTANTLY_API_URL}/campaigns?limit=100`, {
        headers: { Authorization: `Bearer ${instantlyKey}` },
      });
      const campaigns = await campRes.json();
      return new Response(JSON.stringify({ lead_lists: lists.items || [], campaigns: campaigns.items || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'sync') {
      const body = await req.json().catch(() => ({}));
      const state = body.state || 'Arizona';
      const limit = Math.min(body.limit || 25, 100);
      const offset = body.offset || 0;
      const dryRun = body.dry_run === true;
      const listId = body.list_id || null;

      const { data: professionals, error } = await supabase
        .from('professionals')
        .select(`id, name, email, company, zip_code, review_stars_rating, num_total_reviews, profile_link, funnel_status, cities!city_id (name, state)`)
        .eq('active', true)
        .neq('email', '')
        .not('email', 'is', null)
        .range(offset, offset + limit - 1);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const filtered = (professionals || [])
        .filter((p: any) => {
          const cityState = p.cities?.state || '';
          return cityState.toLowerCase() === state.toLowerCase();
        })
        .map((p: any) => ({ ...p, city_name: p.cities?.name || '', state_name: p.cities?.state || '' }));

      if (dryRun) {
        return new Response(JSON.stringify({
          dry_run: true, state, offset, limit, found: filtered.length,
          sample: filtered.slice(0, 5).map((p: any) => ({ name: p.name, email: p.email, city: p.city_name, funnel_status: p.funnel_status })),
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (!listId) {
        return new Response(JSON.stringify({ error: 'list_id required for non-dry-run sync', hint: 'Use action=status to see lists or action=create-list to make one' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let added = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const p of filtered) {
        const { first, last } = splitName(p.name || '');
        try {
          const res = await fetch(`${INSTANTLY_API_URL}/leads`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${instantlyKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: p.email, first_name: first, last_name: last, company_name: p.company || '',
              lead_list_id: listId,
              custom_variables: {
                supabase_id: p.id, city: p.city_name, state: p.state_name,
                rating: String(p.review_stars_rating || ''), reviews: String(p.num_total_reviews || ''),
                profile_url: p.profile_link || '', zip_code: p.zip_code || '',
              },
            }),
          });
          if (res.ok) { added++; }
          else if (res.status === 429) { errors.push(`Rate limited after ${added} leads. Continue with offset=${offset + added}`); break; }
          else {
            const errText = await res.text();
            if (errText.includes('already exists')) { skipped++; } else { errors.push(`${p.email}: ${res.status} ${errText.substring(0, 100)}`); }
          }
        } catch (e) { errors.push(`${p.email}: ${e.message}`); }
        if (added % 10 === 0 && added > 0) { await new Promise(r => setTimeout(r, 500)); }
      }

      return new Response(JSON.stringify({ state, list_id: listId, offset, limit, found: filtered.length, added, skipped, errors: errors.length > 0 ? errors : undefined, next_offset: offset + limit }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'create-list') {
      const body = await req.json().catch(() => ({}));
      if (!body.name) {
        return new Response(JSON.stringify({ error: 'name required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const res = await fetch(`${INSTANTLY_API_URL}/lead-lists`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${instantlyKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: body.name }),
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      actions: { status: 'GET - Lists and campaigns', sync: 'POST - {state, limit, offset, list_id, dry_run}', 'create-list': 'POST - {name}' },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
