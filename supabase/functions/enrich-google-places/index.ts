import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-enrichment-key",
};

const ENRICHMENT_KEY = "t10l_enrich_0448c4870d72ed90fd43171123fd0e44558f019a2b5807d1b297604dad6b235a";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function nameMatch(googleName: string, agentName: string, company: string | null): boolean {
  const gn = normalize(googleName);
  const nameParts = agentName.toLowerCase().split(/\s+/);
  const lastName = nameParts[nameParts.length - 1];
  const firstName = nameParts[0];
  const cn = company ? normalize(company) : '';

  if (gn.includes(normalize(lastName)) && gn.includes(normalize(firstName))) return true;
  if (cn && cn.length > 3 && gn.includes(cn)) return true;
  if (gn.includes(normalize(lastName)) && (
    gn.includes('realestate') || gn.includes('realty') || gn.includes('realtor') ||
    gn.includes('properties') || gn.includes('group') || gn.includes('team')
  )) return true;

  return false;
}

async function searchPlace(apiKey: string, agentName: string, company: string | null, city: string | null, state: string | null): Promise<any | null> {
  const parts = [agentName];
  if (company) parts.push(company);
  parts.push('real estate agent');
  if (city) parts.push(city);
  if (state) parts.push(state);

  const resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri,places.regularOpeningHours,places.photos,places.types,places.businessStatus',
    },
    body: JSON.stringify({ textQuery: parts.join(' '), maxResultCount: 5 }),
  });

  if (!resp.ok) {
    console.error(`Places search failed: ${resp.status} ${await resp.text()}`);
    return null;
  }

  const data = await resp.json();
  const places = data.places || [];
  if (places.length === 0) return null;

  for (const place of places) {
    if (nameMatch(place.displayName?.text || '', agentName, company)) return place;
  }

  const first = places[0];
  const types = first.types || [];
  if (types.some((t: string) => ['real_estate_agency', 'real_estate_agent'].includes(t))) return first;

  return null;
}

function buildUpdate(place: any, existingAddress: string | null): Record<string, any> {
  const update: Record<string, any> = {
    google_place_id: place.id,
    google_review_rating: place.rating || null,
    google_review_count: place.userRatingCount || null,
    google_business_name: place.displayName?.text || null,
    google_address: place.formattedAddress || null,
    google_phone: place.nationalPhoneNumber || null,
    google_website: place.websiteUri || null,
    google_maps_url: place.googleMapsUri || null,
    google_hours: place.regularOpeningHours || null,
    google_types: place.types || null,
    google_enriched_at: new Date().toISOString(),
  };

  if (place.photos?.length) {
    update.google_photos = place.photos.slice(0, 5).map((p: any) => ({
      name: p.name, width: p.widthPx, height: p.heightPx, authorAttributions: p.authorAttributions,
    }));
  }

  // Backfill address if empty
  if (!existingAddress && place.formattedAddress) {
    const parts = place.formattedAddress.split(',').map((s: string) => s.trim());
    if (parts.length >= 3) {
      update.address = parts[0];
      update.business_city = parts[1];
      const stateZip = parts.slice(2).join(' ').match(/([A-Z]{2})\s+(\d{5})/);
      if (stateZip) {
        update.business_state = stateZip[1];
        update.business_zip = stateZip[2];
        update.zip_code = stateZip[2];
      }
    }
  }

  return update;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const enrichKey = req.headers.get("x-enrichment-key");
  if (enrichKey !== ENRICHMENT_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const reqUrl = new URL(req.url);
  const action = reqUrl.searchParams.get("action");

  try {
    // === STATS (no Google key needed) ===
    if (action === "stats") {
      const { count: total } = await supabase.from("professionals").select("id", { count: "exact", head: true }).eq("active", true);
      const { count: enriched } = await supabase.from("professionals").select("id", { count: "exact", head: true }).eq("active", true).not("google_enriched_at", "is", null);
      const { count: withRating } = await supabase.from("professionals").select("id", { count: "exact", head: true }).eq("active", true).not("google_review_rating", "is", null);

      return new Response(JSON.stringify({
        total_active: total, google_enriched: enriched, with_google_rating: withRating,
        remaining: (total || 0) - (enriched || 0),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // All other actions need Google API key
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!GOOGLE_API_KEY) {
      return new Response(JSON.stringify({
        error: "GOOGLE_PLACES_API_KEY not configured",
        fix: "cd C:\\Edge\\list-wise-boost && npx supabase secrets set GOOGLE_PLACES_API_KEY=your_key --project-ref wiotrvoirdgzfacuuiem",
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === ENRICH ONE ===
    if (action === "enrich-one") {
      const { professional_id } = await req.json();
      if (!professional_id) throw new Error("professional_id required");

      const { data: prof, error } = await supabase
        .from("professionals")
        .select("id, name, company, business_city, business_state, state_slug, address")
        .eq("id", professional_id).single();
      if (error || !prof) throw new Error("Professional not found");

      const city = prof.business_city || null;
      const state = prof.business_state || (prof.state_slug ? prof.state_slug.replace(/-/g, ' ') : null);
      const place = await searchPlace(GOOGLE_API_KEY, prof.name, prof.company, city, state);

      if (!place) {
        await supabase.from("professionals").update({ google_enriched_at: new Date().toISOString() }).eq("id", professional_id);
        return new Response(JSON.stringify({ success: true, matched: false, professional_id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const update = buildUpdate(place, prof.address);
      await supabase.from("professionals").update(update).eq("id", professional_id);

      return new Response(JSON.stringify({
        success: true, matched: true, professional_id,
        google_place_id: place.id, google_business_name: place.displayName?.text,
        google_rating: place.rating, google_reviews: place.userRatingCount,
        address_backfilled: !prof.address && !!place.formattedAddress,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === BATCH ===
    if (action === "batch") {
      const body = await req.json().catch(() => ({}));
      const limit = Math.min(body.limit || 10, 50);
      const state_filter = body.state || null;

      let query = supabase
        .from("professionals")
        .select("id, name, company, business_city, business_state, state_slug, address")
        .is("google_enriched_at", null).eq("active", true)
        .order("created_at", { ascending: false }).limit(limit);

      if (state_filter) query = query.eq("state_slug", state_filter);

      const { data: pros, error } = await query;
      if (error) throw error;

      const results: any[] = [];
      let matched = 0;

      for (const prof of (pros || [])) {
        try {
          const city = prof.business_city || null;
          const state = prof.business_state || (prof.state_slug ? prof.state_slug.replace(/-/g, ' ') : null);
          const place = await searchPlace(GOOGLE_API_KEY, prof.name, prof.company, city, state);

          if (place) {
            const update = buildUpdate(place, prof.address);
            await supabase.from("professionals").update(update).eq("id", prof.id);
            matched++;
            results.push({ id: prof.id, name: prof.name, matched: true, place: place.displayName?.text, rating: place.rating });
          } else {
            await supabase.from("professionals").update({ google_enriched_at: new Date().toISOString() }).eq("id", prof.id);
            results.push({ id: prof.id, name: prof.name, matched: false });
          }

          await new Promise(r => setTimeout(r, 100)); // rate limit
        } catch (err) {
          results.push({ id: prof.id, name: prof.name, error: err.message });
        }
      }

      return new Response(JSON.stringify({ success: true, processed: results.length, matched, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action. Use: enrich-one, batch, stats" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
