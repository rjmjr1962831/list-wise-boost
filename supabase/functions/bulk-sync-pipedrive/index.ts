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

async function createOrUpdatePerson(prospect: any, fieldMapping: Record<string, string>): Promise<{ personId: number; action: string }> {
  let personId = prospect.pipedrive_person_id;
  let action = "updated";

  // Search by email if no Pipedrive ID
  if (!personId && prospect.email) {
    personId = await searchPersonByEmail(prospect.email);
  }

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

  // Add custom fields
  if (fieldMapping.supabase_id) personData[fieldMapping.supabase_id] = prospect.id;
  if (fieldMapping.company && prospect.company) personData[fieldMapping.company] = prospect.company;
  if (fieldMapping.zillow_position && prospect.zillow_position) personData[fieldMapping.zillow_position] = prospect.zillow_position;
  if (fieldMapping.zillow_page && prospect.zillow_page) personData[fieldMapping.zillow_page] = prospect.zillow_page;
  if (fieldMapping.agents_ahead && prospect.agents_ahead) personData[fieldMapping.agents_ahead] = prospect.agents_ahead;
  if (fieldMapping.zillow_total_agents && prospect.zillow_total_agents) personData[fieldMapping.zillow_total_agents] = prospect.zillow_total_agents;
  if (fieldMapping.zillow_rating && prospect.zillow_rating) personData[fieldMapping.zillow_rating] = prospect.zillow_rating;
  if (fieldMapping.zillow_reviews && prospect.zillow_reviews) personData[fieldMapping.zillow_reviews] = prospect.zillow_reviews;
  if (fieldMapping.zillow_profile_url && prospect.zillow_profile_url) personData[fieldMapping.zillow_profile_url] = prospect.zillow_profile_url;
  if (fieldMapping.prospect_status && prospect.status) personData[fieldMapping.prospect_status] = prospect.status;

  let url: string;
  let method: string;

  if (personId) {
    url = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/persons/${personId}?api_token=${PIPEDRIVE_API_TOKEN}`;
    method = "PUT";
    action = "updated";
  } else {
    url = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/persons?api_token=${PIPEDRIVE_API_TOKEN}`;
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

    if (!prospects || prospects.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No prospects to sync", synced: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fieldMapping = await getFieldMapping();
    const results = { created: 0, updated: 0, errors: 0 };

    for (const prospect of prospects) {
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
      } catch (error) {
        console.error(`Error syncing prospect ${prospect.id}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
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
  } catch (error) {
    console.error("Bulk sync error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
