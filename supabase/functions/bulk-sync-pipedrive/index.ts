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

// Helper to safely extract error message
function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

// Rate limit: Pipedrive allows 80 requests per 2 seconds
const DELAY_MS = 100;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function searchOrganizationByName(name: string): Promise<number | null> {
  const url = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v2/organizations/search?term=${encodeURIComponent(name)}&api_token=${PIPEDRIVE_API_TOKEN}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.success && data.data?.length > 0) {
    return data.data[0].id;
  }
  return null;
}

async function createOrganization(name: string): Promise<number> {
  const url = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v2/organizations?api_token=${PIPEDRIVE_API_TOKEN}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(`Failed to create organization: ${JSON.stringify(data)}`);
  }

  return data.data.id;
}

async function findOrCreateOrganization(companyName: string): Promise<number> {
  // Search for existing organization
  let orgId = await searchOrganizationByName(companyName);

  // Create if not found
  if (!orgId) {
    orgId = await createOrganization(companyName);
  }

  return orgId;
}

async function createOrUpdatePerson(prospect: any, fieldMapping: Record<string, string>): Promise<{ personId: number; action: string }> {
  let personId = prospect.pipedrive_person_id;
  let action = "updated";

  // Search by email if no Pipedrive ID
  if (!personId && prospect.email) {
    personId = await searchPersonByEmail(prospect.email);
  }

  // Check if this prospect is also a professional (has a card)
  let cardUrl: string | undefined;
  if (prospect.email) {
    const { data: professional } = await supabase
      .from("professionals")
      .select("id, city_id, category_id, name")
      .eq("email", prospect.email)
      .eq("active", true)
      .maybeSingle();

    if (professional) {
      // Generate card URL
      const { data: city } = await supabase
        .from("cities")
        .select("slug")
        .eq("id", professional.city_id)
        .maybeSingle();

      const { data: category } = await supabase
        .from("categories")
        .select("slug")
        .eq("id", professional.category_id)
        .maybeSingle();

      if (city && category) {
        const slug = professional.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        cardUrl = `https://www.top10lists.us/${city.slug}/${category.slug}/${slug}`;
      }
    }
  }

  const personData: Record<string, any> = {
    name: prospect.name,
    emails: prospect.email ? [{ value: prospect.email, primary: true }] : undefined,
    phones: prospect.phone ? [{ value: prospect.phone, primary: true }] : undefined,
  };

  // Link to organization if company exists
  if (prospect.company) {
    const orgId = await findOrCreateOrganization(prospect.company);
    personData.org_id = orgId;
  }

  // DYNAMIC FIELD MAPPING - Build complete field data object
  const dynamicFields: Record<string, any> = {
    supabase_id: prospect.id,
    company: prospect.company,
    zillow_position: prospect.zillow_position,
    zillow_page: prospect.zillow_page,
    agents_ahead: prospect.agents_ahead,
    zillow_total_agents: prospect.zillow_total_agents,
    zillow_rating: prospect.zillow_rating,
    zillow_reviews: prospect.zillow_reviews,
    zillow_profile_url: prospect.zillow_profile_url,
    prospect_status: prospect.status,
    card_url: cardUrl,
    city_name: prospect.city,
    state: prospect.state,
  };

  // Apply all mapped fields dynamically - only sync fields that have a mapping
  for (const [fieldName, value] of Object.entries(dynamicFields)) {
    if (fieldMapping[fieldName] && value !== null && value !== undefined) {
      personData[fieldMapping[fieldName]] = value;
    }
  }

  let url: string;
  let method: string;

  if (personId) {
    url = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v2/persons/${personId}?api_token=${PIPEDRIVE_API_TOKEN}`;
    method = "PATCH";
    action = "updated";
  } else {
    url = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v2/persons?api_token=${PIPEDRIVE_API_TOKEN}`;
    method = "POST";
    action = "created";
  }

  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(personData),
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(`Failed to ${action} person: ${JSON.stringify(data)}`);
  }

  return { personId: data.data.id, action };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // TEMPORARILY DISABLED - Pipedrive API consuming excessive tokens
  console.log("⛔ PIPEDRIVE SYNC DISABLED - bulk-sync-pipedrive called but blocked");
  return new Response(
    JSON.stringify({ 
      success: false, 
      error: "Pipedrive sync is temporarily disabled. Contact admin to re-enable.",
      disabled: true 
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );

  try {
    const body = await req.json();
    const limit = body.limit || 100;
    const city = body.city;

    // Get unsynced prospects with email
    let query = supabase
      .from("prospects")
      .select("*")
      .not("email", "is", null)
      .or("pipedrive_synced.is.null,pipedrive_synced.eq.false")
      .limit(limit);

    if (city) {
      query = query.eq("city", city);
    }

    const { data: prospects, error } = await query;

    if (error) throw error;

    const prospectsData = prospects ?? [];
    if (prospectsData.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No prospects to sync", synced: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fieldMapping = await getFieldMapping();
    const results = { created: 0, updated: 0, errors: 0 };

    for (const prospect of prospectsData) {
      try {
        const { personId, action } = await createOrUpdatePerson(prospect, fieldMapping);

        // Update Supabase
        await supabase
          .from("prospects")
          .update({
            pipedrive_person_id: personId,
            pipedrive_synced: true,
            pipedrive_synced_at: new Date().toISOString(),
            pipedrive_last_error: null,
          })
          .eq("id", prospect.id);

        if (action === "created") results.created++;
        else results.updated++;

        // Rate limit delay
        await delay(DELAY_MS);
      } catch (err) {
        console.error(`Error syncing prospect ${prospect.id}:`, err);
        const errorMessage = getErrorMessage(err);
        results.errors++;

        // Update with error
        await supabase
          .from("prospects")
          .update({
            pipedrive_synced: false,
            pipedrive_last_error: errorMessage,
          })
          .eq("id", prospect.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${results.created + results.updated} prospects`,
        ...results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Bulk sync error:", err);
    const errorMessage = getErrorMessage(err);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
