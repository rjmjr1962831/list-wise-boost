import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PIPEDRIVE_API_TOKEN = Deno.env.get("PIPEDRIVE_API_TOKEN")!;
const PIPEDRIVE_DOMAIN = Deno.env.get("PIPEDRIVE_DOMAIN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getFieldMapping(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("pipedrive_field_mapping")
    .select("field_name, pipedrive_key");

  if (error) throw error;

  const mapping: Record<string, string> = {};
  for (const row of data || []) {
    mapping[row.field_name] = row.pipedrive_key;
  }
  return mapping;
}

async function searchPersonByEmail(email: string): Promise<number | null> {
  const url = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v2/persons/search?term=${encodeURIComponent(email)}&fields=emails&exact_match=true&api_token=${PIPEDRIVE_API_TOKEN}`;

  const response = await fetch(url);
  const data = await response.json();

  console.log(`🔍 Pipedrive search by email response for ${email}:`, JSON.stringify(data, null, 2));

  // v2 search returns results under data.items[]. Each item may either be the
  // person object itself or wrapped under an "item" key depending on account.
  const items = data?.data?.items;
  if (data.success && Array.isArray(items) && items.length > 0) {
    const first = items[0];
    const personId = first?.item?.id ?? first?.id;
    return typeof personId === "number" ? personId : null;
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { professional_id } = await req.json();

    if (!professional_id) {
      throw new Error("professional_id is required");
    }

    console.log(`Syncing professional ${professional_id} to Pipedrive`);

    // Get professional with related data
    const { data: professional, error: fetchError } = await supabase
      .from("professionals")
      .select(`
        *,
        cities:city_id (id, name, state, state_slug, slug),
        categories:category_id (id, name, slug)
      `)
      .eq("id", professional_id)
      .single();

    if (fetchError || !professional) {
      throw new Error(`Professional not found: ${professional_id}`);
    }

    if (!professional.email) {
      return new Response(
        JSON.stringify({ success: false, error: "Professional has no email" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fieldMapping = await getFieldMapping();
    const city = Array.isArray(professional.cities) ? professional.cities[0] : professional.cities;
    const category = Array.isArray(professional.categories) ? professional.categories[0] : professional.categories;

    if (!city || !category) {
      throw new Error("Missing city or category data");
    }

    // Build card URL to match app route structure: /:stateSlug/:citySlug/:categorySlug/:agentSlug
    const agentSlug = professional.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const stateSlug = city.state_slug;
    const citySlug = city.slug;
    const categorySlug = category.slug;
    const cardUrl = `https://top10lists.us/${stateSlug}/${citySlug}/${categorySlug}/${agentSlug}`;

    // Search for existing person
    let personId = await searchPersonByEmail(professional.email);
    const isUpdate = !!personId;

    const personData: Record<string, any> = {
      name: professional.name,
      emails: [{ value: professional.email, primary: true }],
      phones: professional.phone ? [{ value: professional.phone, primary: true }] : undefined,
    };

    // Map ALL configured custom fields (keep in sync with bulk sync)
    const dynamicFields: Record<string, any> = {
      // Core IDs & URLs
      supabase_id: professional.id,
      card_url: cardUrl,
      profile_link: professional.profile_link 
        ? (professional.profile_link.startsWith('http') 
            ? professional.profile_link 
            : `https://top10lists.us${professional.profile_link}`)
        : null,

      // Professional Details
      years_experience: professional.years_experience,
      current_listings: professional.current_listings,
      total_sales: professional.total_sales,
      license_number: professional.license_number,
      business_name: professional.business_name || professional.company,
      specialty: Array.isArray(professional.specialty)
        ? professional.specialty.join(', ')
        : professional.specialty,
      website: professional.website,
      rank: professional.rank,
      synthesized_bio: professional.synthesized_bio || professional.description,

      // Badges / flags
      is_top_agent: professional.is_top_agent ? 'YES' : 'NO',
      is_premier_agent: professional.is_premier_agent ? 'YES' : 'NO',
      is_brand_builder: professional.is_brand_builder ? 'YES' : 'NO',
      email_verified: professional.email_verified_at ? 'YES' : 'NO',

      // Status
      active_status: professional.active ? 'Active' : 'Inactive',

      // Location
      city_name: city.name,
      state: city.state,

      // Zillow Data
      zillow_profile_url: professional.zillow_profile_url,
      zillow_rating: professional.review_stars_rating,
      zillow_reviews: professional.num_total_reviews,
      zillow_page: professional.zillow_search_page,
      zillow_position: professional.zillow_search_position,
    };
    // Apply mapped fields to custom_fields object (API v2 format)
    personData.custom_fields = {};
    for (const [fieldName, value] of Object.entries(dynamicFields)) {
      if (fieldMapping[fieldName] && value !== null && value !== undefined) {
        personData.custom_fields[fieldMapping[fieldName]] = value;
      }
    }

    console.log(`📤 Sending to Pipedrive (${isUpdate ? 'UPDATE' : 'CREATE'}):`, JSON.stringify({
      name: personData.name,
      email: personData.emails[0]?.value,
      custom_fields_count: Object.keys(personData.custom_fields).length,
      custom_fields: personData.custom_fields
    }, null, 2));

    let url: string;
    let method: string;

    if (isUpdate) {
      url = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v2/persons/${personId}?api_token=${PIPEDRIVE_API_TOKEN}`;
      method = "PATCH";
    } else {
      url = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v2/persons?api_token=${PIPEDRIVE_API_TOKEN}`;
      method = "POST";
    }

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(personData),
    });

    const data = await response.json();

    console.log(`📥 Pipedrive response:`, JSON.stringify(data, null, 2));

    if (!data.success) {
      console.error(`❌ Pipedrive error for ${professional.name}:`, JSON.stringify(data, null, 2));
      throw new Error(`Failed to ${isUpdate ? 'update' : 'create'} person: ${JSON.stringify(data)}`);
    }

    personId = data.data.id;
    const action = isUpdate ? 'updated' : 'created';

    console.log(`✅ ${action} ${professional.name} in Pipedrive (ID: ${personId})`);

    return new Response(
      JSON.stringify({ success: true, action, personId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
