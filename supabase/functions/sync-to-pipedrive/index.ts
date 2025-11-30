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

interface Prospect {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  city: string | null;
  state: string | null;
  zillow_position: number | null;
  zillow_page: number | null;
  agents_ahead: number | null;
  zillow_total_agents: number | null;
  zillow_rating: number | null;
  zillow_reviews: number | null;
  zillow_profile_url: string | null;
  status: string | null;
  pipedrive_person_id: number | null;
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
  const url = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/persons/search?term=${encodeURIComponent(email)}&fields=email&api_token=${PIPEDRIVE_API_TOKEN}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.success && data.data?.items?.length > 0) {
    return data.data.items[0].item.id;
  }
  return null;
}

async function searchOrganizationByName(name: string): Promise<number | null> {
  const url = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/organizations/search?term=${encodeURIComponent(name)}&api_token=${PIPEDRIVE_API_TOKEN}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.success && data.data?.items?.length > 0) {
    return data.data.items[0].item.id;
  }
  return null;
}

async function createOrganization(name: string): Promise<number> {
  const url = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/organizations?api_token=${PIPEDRIVE_API_TOKEN}`;

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

async function createPerson(prospect: Prospect, fieldMapping: Record<string, string>, cardUrl?: string): Promise<number> {
  const url = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/persons?api_token=${PIPEDRIVE_API_TOKEN}`;

  const personData: Record<string, any> = {
    name: prospect.name,
    email: prospect.email ? [{ value: prospect.email, primary: true }] : undefined,
    phone: prospect.phone ? [{ value: prospect.phone, primary: true }] : undefined,
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

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(personData),
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(`Failed to create person: ${JSON.stringify(data)}`);
  }

  return data.data.id;
}

async function updatePerson(personId: number, prospect: Prospect, fieldMapping: Record<string, string>, cardUrl?: string): Promise<void> {
  const url = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/persons/${personId}?api_token=${PIPEDRIVE_API_TOKEN}`;

  const personData: Record<string, any> = {
    name: prospect.name,
    email: prospect.email ? [{ value: prospect.email, primary: true }] : undefined,
    phone: prospect.phone ? [{ value: prospect.phone, primary: true }] : undefined,
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

  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(personData),
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(`Failed to update person: ${JSON.stringify(data)}`);
  }
}

async function syncProspect(prospect: Prospect): Promise<{ personId: number; action: string }> {
  const fieldMapping = await getFieldMapping();

  // Check if this prospect is also a professional (has a card)
  let cardUrl: string | undefined;
  if (prospect.email) {
    const { data: professional } = await supabase
      .from("professionals")
      .select("id")
      .eq("email", prospect.email)
      .eq("active", true)
      .single();

    if (professional) {
      // Generate card URL
      const { data: city } = await supabase
        .from("cities")
        .select("slug")
        .eq("id", professional.city_id)
        .single();

      const { data: category } = await supabase
        .from("categories")
        .select("slug")
        .eq("id", professional.category_id)
        .single();

      if (city && category) {
        const slug = prospect.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        cardUrl = `https://top10lists.us/${city.slug}/${category.slug}/${slug}`;
      }
    }
  }

  let personId = prospect.pipedrive_person_id;
  let action = "updated";

  // If no Pipedrive ID, search by email
  if (!personId && prospect.email) {
    personId = await searchPersonByEmail(prospect.email);
  }

  if (personId) {
    await updatePerson(personId, prospect, fieldMapping, cardUrl);
    action = "updated";
  } else {
    personId = await createPerson(prospect, fieldMapping, cardUrl);
    action = "created";
  }

  // Update Supabase with Pipedrive ID
  await supabase
    .from("prospects")
    .update({
      pipedrive_person_id: personId,
      pipedrive_synced: true,
      pipedrive_synced_at: new Date().toISOString(),
      pipedrive_last_error: null,
    })
    .eq("id", prospect.id);

  return { personId, action };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { prospect_id, prospect } = body;

    let prospectData: Prospect;

    if (prospect) {
      prospectData = prospect;
    } else if (prospect_id) {
      const { data, error } = await supabase
        .from("prospects")
        .select("*")
        .eq("id", prospect_id)
        .single();

      if (error) throw error;
      prospectData = data;
    } else {
      throw new Error("Either prospect_id or prospect data required");
    }

    if (!prospectData.email) {
      return new Response(
        JSON.stringify({ success: false, error: "Prospect has no email" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await syncProspect(prospectData);

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    const body = await req.json().catch(() => ({}));
    if (body.prospect_id) {
      await supabase
        .from("prospects")
        .update({
          pipedrive_synced: false,
          pipedrive_last_error: errorMessage,
        })
        .eq("id", body.prospect_id);
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
