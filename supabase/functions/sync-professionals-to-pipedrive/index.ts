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

// Helper to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Generate card URL for agent
function generateCardUrl(
  professional: any,
  city: any,
  category: any
): string {
  const stateSlug = city.state_slug || 'az';
  const citySlug = city.slug;
  const categorySlug = category.slug;
  const agentSlug = generateSlug(professional.name);
  
  return `https://www.top10lists.us/${stateSlug}/${citySlug}/${categorySlug}/${agentSlug}`;
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

async function searchPersonByEmail(email: string): Promise<{ personId: number | null; duplicates: number[] }> {
  const url = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v2/persons/search?term=${encodeURIComponent(email)}&fields=email&exact_match=true&api_token=${PIPEDRIVE_API_TOKEN}`;

  const response = await fetch(url);
  const data = await response.json();

  // v2 search returns results under data.items[]
  const items = data?.data?.items;
  if (data.success && Array.isArray(items) && items.length > 0) {
    // Get all person IDs
    const allIds = items
      .map((item: any) => item?.item?.id ?? item?.id)
      .filter((id: any) => typeof id === "number");

    if (allIds.length === 0) {
      return { personId: null, duplicates: [] };
    }

    // Return the oldest (first) and mark rest as duplicates
    const [personId, ...duplicates] = allIds;
    
    if (duplicates.length > 0) {
      console.log(`⚠️ Found ${duplicates.length} duplicate(s) for ${email}, will use ID ${personId}`);
    }

    return { personId, duplicates };
  }

  return { personId: null, duplicates: [] };
}

async function deleteDuplicates(duplicateIds: number[]): Promise<void> {
  if (duplicateIds.length === 0) return;

  console.log(`🗑️ Deleting ${duplicateIds.length} duplicate contact(s)...`);
  
  for (const id of duplicateIds) {
    try {
      const url = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v2/persons/${id}?api_token=${PIPEDRIVE_API_TOKEN}`;
      const response = await fetch(url, { method: "DELETE" });
      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Deleted duplicate contact ID ${id}`);
      } else {
        console.error(`❌ Failed to delete duplicate ID ${id}:`, result);
      }
    } catch (err) {
      console.error(`Error deleting duplicate ID ${id}:`, err);
    }
    
    // Rate limit: 250ms between deletes
    await new Promise(resolve => setTimeout(resolve, 250));
  }
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
  let orgId = await searchOrganizationByName(companyName);
  if (!orgId) {
    orgId = await createOrganization(companyName);
  }
  return orgId;
}

async function createOrUpdatePerson(
  professional: any,
  city: any,
  category: any,
  fieldMapping: Record<string, string>
): Promise<{ personId: number; action: string }> {
  // Search for existing person and handle duplicates
  const { personId: foundPersonId, duplicates } = await searchPersonByEmail(professional.email);
  
  // Delete any duplicates before proceeding
  if (duplicates.length > 0) {
    await deleteDuplicates(duplicates);
  }
  
  let personId = foundPersonId;
  let action = personId ? "updated" : "created";
  const isUpdate = !!personId;

  const cardUrl = generateCardUrl(professional, city, category);

  const personData: Record<string, any> = {
    name: professional.name,
    emails: professional.email ? [{ value: professional.email, primary: true }] : undefined,
    phones: professional.phone ? [{ value: professional.phone, primary: true }] : undefined,
    // Always set label to "Warm lead" (ID 16) for active professionals
    label_ids: professional.active ? [16] : undefined,
    // Only set marketing status on FIRST sync (create), not on updates
    // After first sync, Pipedrive is the source of truth for marketing status
    ...(isUpdate ? {} : { marketing_status: "subscribed" }),
  };

  // Link to organization if company exists
  if (professional.company) {
    const orgId = await findOrCreateOrganization(professional.company);
    personData.org_id = orgId;
  }

  // DYNAMIC FIELD MAPPING - Build complete field data object
  const dynamicFields: Record<string, any> = {
    // Core IDs & URLs
    supabase_id: professional.id,
    card_url: cardUrl,
    profile_link: professional.profile_link, // Magic link for agent profile access
    
    // Professional Details
    years_experience: professional.years_experience,
    current_listings: professional.current_listings,
    total_sales: professional.total_sales,
    license_number: professional.license_number,
    business_name: professional.business_name || professional.company,
    specialty: Array.isArray(professional.specialty) ? professional.specialty.join(', ') : professional.specialty,
    website: professional.website,
    rank: professional.rank,
    synthesized_bio: professional.synthesized_bio || professional.description,
    
    // Badges (convert boolean to YES/NO)
    is_top_agent: professional.is_top_agent ? 'YES' : 'NO',
    is_premier_agent: professional.is_premier_agent ? 'YES' : 'NO',
    is_brand_builder: professional.is_brand_builder ? 'YES' : 'NO',
    email_verified: professional.email_verified_at ? 'YES' : 'NO',
    
    // Status
    active_status: professional.active ? 'active' : 'inactive',
    
    // Location
    city_name: city?.name,
    state: city?.state,
    
    // Zillow Data
    zillow_profile_url: professional.zillow_profile_url,
    zillow_rating: professional.review_stars_rating,
    zillow_reviews: professional.num_total_reviews,
    zillow_page: professional.zillow_search_page,
    zillow_position: professional.zillow_search_position,
  };

  // Apply all mapped fields dynamically - use custom_fields object for API v2
  personData.custom_fields = {};
  for (const [fieldName, value] of Object.entries(dynamicFields)) {
    if (fieldMapping[fieldName] && value !== null && value !== undefined) {
      personData.custom_fields[fieldMapping[fieldName]] = value;
    }
  }

  let url: string;
  let method: string;

  if (personId) {
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
    throw new Error(`Failed to ${action} person: ${JSON.stringify(data)}`);
  }

  console.log(`✅ ${action} ${professional.name} with card URL: ${cardUrl}`);

  return { personId: data.data.id, action };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const limit = body.limit || 50;
    const cityName = body.city;

    // Get professionals with email addresses
    let query = supabase
      .from("professionals")
      .select(`
        *,
        cities:city_id (id, name, slug, state, state_slug),
        categories:category_id (id, name, slug, plural_name)
      `)
      .eq("active", true)
      .not("email", "is", null)
      .limit(limit);

    if (cityName) {
      // Join with cities to filter by city name
      const { data: cityData } = await supabase
        .from("cities")
        .select("id")
        .ilike("name", `%${cityName}%`)
        .single();

      if (cityData) {
        query = query.eq("city_id", cityData.id);
      }
    }

    const { data: professionals, error } = await query;

    if (error) throw error;

    if (!professionals || professionals.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No professionals to sync", 
          synced: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📊 Syncing ${professionals.length} professionals to Pipedrive...`);

    const fieldMapping = await getFieldMapping();
    const results = { created: 0, updated: 0, errors: 0 };
    const errorDetails: string[] = [];

    for (const professional of professionals) {
      try {
        // Get city and category data
        const city = Array.isArray(professional.cities) 
          ? professional.cities[0] 
          : professional.cities;
        const category = Array.isArray(professional.categories)
          ? professional.categories[0]
          : professional.categories;

        if (!city || !category) {
          console.warn(`⚠️ Skipping ${professional.name}: missing city or category data`);
          continue;
        }

        const { action } = await createOrUpdatePerson(
          professional,
          city,
          category,
          fieldMapping
        );

        if (action === "created") results.created++;
        else results.updated++;

        // Rate limit delay
        await delay(DELAY_MS);
      } catch (error) {
        console.error(`❌ Error syncing professional ${professional.id}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.errors++;
        errorDetails.push(`${professional.name}: ${errorMessage}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${results.created + results.updated} professionals`,
        ...results,
        errors: errorDetails.length > 0 ? errorDetails : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Bulk sync error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
