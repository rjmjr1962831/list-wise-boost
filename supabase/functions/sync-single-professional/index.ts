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
  const url = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v2/persons/search?term=${encodeURIComponent(email)}&fields=emails&api_token=${PIPEDRIVE_API_TOKEN}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.success && data.data?.length > 0) {
    return data.data[0].id;
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

    // Search for existing person
    let personId = await searchPersonByEmail(professional.email);
    const isUpdate = !!personId;

    const personData: Record<string, any> = {
      name: professional.name,
      emails: [{ value: professional.email, primary: true }],
      phones: professional.phone ? [{ value: professional.phone, primary: true }] : undefined,
    };

    // Map custom fields
    const dynamicFields: Record<string, any> = {
      current_listings: professional.current_listings,
      total_sales: professional.total_sales,
      license_number: professional.license_number,
      rank: professional.rank,
      synthesized_bio: professional.synthesized_bio || professional.description,
      is_top_agent: professional.is_top_agent ? 'YES' : 'NO',
      is_premier_agent: professional.is_premier_agent ? 'YES' : 'NO',
      city_name: city.name,
      state: city.state,
    };

    // Apply mapped fields
    for (const [fieldName, value] of Object.entries(dynamicFields)) {
      if (fieldMapping[fieldName] && value !== null && value !== undefined) {
        personData[fieldMapping[fieldName]] = value;
      }
    }

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

    if (!data.success) {
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
