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

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

// Generate hash of syncable data for change detection
function generateSyncHash(data: Record<string, any>): string {
  const sortedJson = JSON.stringify(data, Object.keys(data).sort());
  // Simple hash using string operations (sufficient for change detection)
  let hash = 0;
  for (let i = 0; i < sortedJson.length; i++) {
    const char = sortedJson.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(16);
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

// Check org cache first, then Pipedrive API
async function getCachedOrg(orgName: string): Promise<number | null> {
  const { data } = await supabase
    .from("pipedrive_org_cache")
    .select("pipedrive_org_id")
    .eq("org_name", orgName.trim().toLowerCase())
    .single();
  
  return data?.pipedrive_org_id || null;
}

async function cacheOrg(orgName: string, orgId: number): Promise<void> {
  await supabase
    .from("pipedrive_org_cache")
    .upsert({
      org_name: orgName.trim().toLowerCase(),
      pipedrive_org_id: orgId,
      updated_at: new Date().toISOString()
    }, { onConflict: 'org_name' });
}

async function searchOrganizationByName(name: string): Promise<number | null> {
  const url = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v2/organizations/search?term=${encodeURIComponent(name)}&exact_match=true&api_token=${PIPEDRIVE_API_TOKEN}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  const items = data?.data?.items;
  if (data.success && Array.isArray(items) && items.length > 0) {
    const orgId = items[0]?.item?.id ?? items[0]?.id;
    if (typeof orgId === "number") {
      console.log(`🏢 Found existing organization "${name}" (ID: ${orgId})`);
      return orgId;
    }
  }
  
  return null;
}

async function createOrganization(name: string): Promise<number> {
  const url = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v2/organizations?api_token=${PIPEDRIVE_API_TOKEN}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`Failed to create organization: ${JSON.stringify(data)}`);
  }
  
  console.log(`🏢 Created new organization "${name}" (ID: ${data.data.id})`);
  return data.data.id;
}

// Optimized: Check cache first, then API, then create
async function findOrCreateOrganization(companyName: string): Promise<number | null> {
  if (!companyName || companyName.trim() === '') {
    return null;
  }
  
  const trimmedName = companyName.trim();
  
  // 1. Check cache first (no API call)
  const cachedOrgId = await getCachedOrg(trimmedName);
  if (cachedOrgId) {
    console.log(`📦 Using cached org ID for "${trimmedName}": ${cachedOrgId}`);
    return cachedOrgId;
  }
  
  // 2. Search Pipedrive API
  const existingOrgId = await searchOrganizationByName(trimmedName);
  if (existingOrgId) {
    await cacheOrg(trimmedName, existingOrgId);
    return existingOrgId;
  }
  
  // 3. Create new organization
  const newOrgId = await createOrganization(trimmedName);
  await cacheOrg(trimmedName, newOrgId);
  return newOrgId;
}

// Get sync state for change detection
async function getSyncState(professionalId: string): Promise<{ personId: number | null; lastHash: string | null }> {
  const { data } = await supabase
    .from("pipedrive_sync_state")
    .select("pipedrive_person_id, last_sync_hash")
    .eq("professional_id", professionalId)
    .single();
  
  return {
    personId: data?.pipedrive_person_id || null,
    lastHash: data?.last_sync_hash || null
  };
}

// Update sync state after successful sync
async function updateSyncState(
  professionalId: string, 
  personId: number, 
  hash: string,
  syncData: Record<string, any>
): Promise<void> {
  await supabase
    .from("pipedrive_sync_state")
    .upsert({
      professional_id: professionalId,
      pipedrive_person_id: personId,
      last_sync_hash: hash,
      last_synced_at: new Date().toISOString(),
      last_synced_data: syncData,
      updated_at: new Date().toISOString()
    }, { onConflict: 'professional_id' });
}

// Only search Pipedrive if we don't have a cached person ID
// CRITICAL: This function must throw on API errors to prevent duplicate creation
async function searchPersonByEmail(email: string): Promise<number | null> {
  const url = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v2/persons/search?term=${encodeURIComponent(email)}&fields=email&exact_match=true&api_token=${PIPEDRIVE_API_TOKEN}`;

  const response = await fetch(url);
  
  // CRITICAL: Check for non-JSON responses (rate limits, auth errors)
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    console.error(`❌ Pipedrive search returned non-JSON (${response.status}): ${text.substring(0, 200)}`);
    throw new Error(`Pipedrive API error during email search (${response.status})`);
  }
  
  const data = await response.json();
  
  // Check for API-level errors
  if (!response.ok || data.error) {
    console.error(`❌ Pipedrive search API error:`, data);
    throw new Error(`Pipedrive search failed: ${data.error || response.status}`);
  }

  const items = data?.data?.items;
  if (data.success && Array.isArray(items) && items.length > 0) {
    const personId = items[0]?.item?.id ?? items[0]?.id;
    if (typeof personId === "number") {
      console.log(`🔍 Found existing person for ${email}: ID ${personId}`);
      return personId;
    }
  }

  console.log(`🔍 No existing person found for ${email}`);
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { professional_id, force = false } = await req.json();

    if (!professional_id) {
      throw new Error("professional_id is required");
    }

    console.log(`🔄 Syncing professional ${professional_id} (force: ${force})`);

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
        JSON.stringify({ success: false, error: "Professional has no email", skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const city = Array.isArray(professional.cities) ? professional.cities[0] : professional.cities;
    const category = Array.isArray(professional.categories) ? professional.categories[0] : professional.categories;

    if (!city || !category) {
      throw new Error("Missing city or category data");
    }

    // Build sync data object for hashing
    const agentSlug = professional.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const cardUrl = `https://www.top10lists.us/${city.state_slug}/${city.slug}/${category.slug}/${agentSlug}`;
    
    const syncData: Record<string, any> = {
      name: professional.name,
      email: professional.email,
      phone: professional.phone || '',
      company: professional.business_name || professional.company || '',
      profile_link: professional.profile_link || '',
      card_url: cardUrl,
      years_experience: professional.years_experience ?? null,
      current_listings: professional.current_listings ?? null,
      total_sales: professional.total_sales ?? null,
      rank: professional.rank ?? null,
      zillow_rating: professional.review_stars_rating ?? null,
      zillow_reviews: professional.num_total_reviews ?? null,
      license_number: professional.license_number || '',
      specialty: Array.isArray(professional.specialty) ? professional.specialty.join(', ') : '',
      website: professional.website || '',
      synthesized_bio: professional.synthesized_bio || professional.description || '',
      state: city.state || '',
      // Include active status in hash so label changes trigger resync
      active: professional.active,
      // Funnel & subscription tracking fields
      funnel_status: professional.funnel_status || '',
      funnel_started_at: professional.funnel_started_at || null,
      subscription_status: professional.subscription_status || 'none',
      monthly_revenue: professional.monthly_revenue_cents ? (professional.monthly_revenue_cents / 100) : null,
      promo_code_used: professional.promo_code_used || '',
      last_payment_date: professional.last_payment_at || null,
      last_payment_status: professional.last_payment_status || '',
      cities_subscribed: Array.isArray(professional.cities_subscribed) ? professional.cities_subscribed.join(', ') : '',
    };

    // Generate hash for change detection
    const currentHash = generateSyncHash(syncData);
    
    // Get cached sync state
    const { personId: cachedPersonId, lastHash } = await getSyncState(professional_id);

    // CHANGE DETECTION: Skip if data hasn't changed (unless force=true)
    if (!force && lastHash === currentHash && cachedPersonId) {
      console.log(`⏭️ Skipping ${professional.name} - no changes detected (hash: ${currentHash})`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          action: 'skipped', 
          reason: 'no_changes',
          personId: cachedPersonId 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fieldMapping = await getFieldMapping();

    // Determine person ID: use cached, or search Pipedrive
    let personId = cachedPersonId;
    if (!personId) {
      console.log(`🔍 No cached person ID, searching Pipedrive for ${professional.email}`);
      personId = await searchPersonByEmail(professional.email);
    }
    
    const isUpdate = !!personId;

    // Find or create organization (uses cache)
    const orgId = await findOrCreateOrganization(syncData.company);

    // Build person data for Pipedrive
    const personData: Record<string, any> = {
      name: syncData.name,
      emails: [{ value: syncData.email, primary: true }],
      phones: syncData.phone ? [{ value: syncData.phone, primary: true }] : undefined,
      org_id: orgId,
      // Always set label to "Warm lead" (ID 16) for active professionals
      label_ids: professional.active ? [16] : undefined,
      // Only set marketing status on FIRST sync (create), not on updates
      // After first sync, Pipedrive is the source of truth for marketing status
      ...(isUpdate ? {} : { marketing_status: "subscribed" }),
    };

    // Map custom fields
    // Helper to truncate strings to Pipedrive's 255 char limit
    const truncate = (str: string, max = 255) => str && str.length > max ? str.substring(0, max - 3) + '...' : str;

    // Extract address components from business_address JSON
    const businessAddress = professional.business_address || {};
    const streetAddress = businessAddress.address1 || professional.address || '';
    const street2 = businessAddress.address2 || '';
    const addressCity = businessAddress.city || city.name || '';
    const addressState = businessAddress.state || city.state || '';
    const zipCode = businessAddress.postalCode || professional.zip_code || '';

    // Helper to ensure numbers are numbers (not strings), null if invalid
    const toNumber = (val: any): number | null => {
      if (val === null || val === undefined || val === '') return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    };

    const dynamicFields: Record<string, any> = {
      supabase_id: professional.id,
      card_url: truncate(syncData.card_url),
      profile_link: syncData.profile_link 
        ? truncate(syncData.profile_link.startsWith('http') ? syncData.profile_link : `https://top10lists.us${syncData.profile_link}`)
        : null,
      // Numerical fields - ensure proper number type
      years_experience: toNumber(syncData.years_experience),
      current_listings: toNumber(syncData.current_listings),
      total_sales: toNumber(syncData.total_sales),
      rank: toNumber(syncData.rank),
      zillow_rating: toNumber(syncData.zillow_rating),
      zillow_reviews: toNumber(syncData.zillow_reviews),
      zillow_page: toNumber(professional.zillow_search_page),
      zillow_position: toNumber(professional.zillow_search_position),
      zillow_total_agents: toNumber(professional.zillow_search_total),
      agents_ahead: professional.zillow_search_position ? toNumber(professional.zillow_search_position - 1) : null,
      monthly_revenue: toNumber(syncData.monthly_revenue),
      // String fields
      license_number: truncate(syncData.license_number),
      business_name: truncate(syncData.company),
      specialty: truncate(syncData.specialty),
      website: truncate(syncData.website),
      synthesized_bio: syncData.synthesized_bio, // Text field - no truncation needed
      state: truncate(addressState),
      zillow_profile_url: truncate(professional.zillow_profile_url || ''),
      // Address fields
      street_address: truncate(streetAddress),
      street2: truncate(street2),
      // Status flags - convert booleans to strings for Pipedrive text fields
      // Always set email_verified and consent_given to 'true' for all leads
      email_verified: 'true',
      consent_given: 'true',
      is_brand_builder: professional.is_brand_builder ? 'true' : 'false',
      active_status: professional.active ? 'active' : 'inactive',
      // Funnel & subscription tracking fields
      funnel_status: truncate(syncData.funnel_status),
      funnel_started_at: syncData.funnel_started_at,
      subscription_status: truncate(syncData.subscription_status),
      promo_code_used: truncate(syncData.promo_code_used),
      last_payment_date: syncData.last_payment_date,
      last_payment_status: truncate(syncData.last_payment_status),
      cities_subscribed: truncate(syncData.cities_subscribed),
    };
    
    personData.custom_fields = {};
    for (const [fieldName, value] of Object.entries(dynamicFields)) {
      if (fieldMapping[fieldName] && value !== null && value !== undefined && value !== '') {
        personData.custom_fields[fieldMapping[fieldName]] = value;
      }
    }

    console.log(`📤 ${isUpdate ? 'UPDATE' : 'CREATE'} ${professional.name} (hash: ${currentHash})`);

    // Single API call to create/update person
    const url = isUpdate
      ? `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v2/persons/${personId}?api_token=${PIPEDRIVE_API_TOKEN}`
      : `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v2/persons?api_token=${PIPEDRIVE_API_TOKEN}`;
    
    const method = isUpdate ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(personData),
    });

    let data = await response.json();

    // Handle deleted contact case
    if (!data.success && isUpdate && typeof data.error === "string" && data.error.includes("deleted")) {
      console.warn(`⚠️ Contact ${personId} deleted in Pipedrive, creating new`);
      const createResponse = await fetch(
        `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v2/persons?api_token=${PIPEDRIVE_API_TOKEN}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(personData),
        }
      );
      data = await createResponse.json();
    }

    if (!data.success) {
      console.error(`❌ Pipedrive error:`, JSON.stringify(data, null, 2));
      throw new Error(`Failed to ${isUpdate ? 'update' : 'create'} person: ${JSON.stringify(data)}`);
    }

    const finalPersonId = data.data.id;
    const action = isUpdate ? 'updated' : 'created';

    // Update sync state for future change detection
    await updateSyncState(professional_id, finalPersonId, currentHash, syncData);

    console.log(`✅ ${action} ${professional.name} (ID: ${finalPersonId})`);

    // Create a Lead for ACTIVE professionals (always attempt, relies on "already exists" check)
    let leadId = null;
    if (professional.active) {
      try {
        // Check if a Lead already exists for this person
        const existingLeadUrl = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/leads?person_id=${finalPersonId}&api_token=${PIPEDRIVE_API_TOKEN}`;
        const existingLeadResp = await fetch(existingLeadUrl);
        const existingLeadData = await existingLeadResp.json();
        
        const hasExistingLead = existingLeadData.success && 
          Array.isArray(existingLeadData.data) && 
          existingLeadData.data.length > 0;

        if (!hasExistingLead) {
          // Create a new Lead linked to this Person
          const leadUrl = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/leads?api_token=${PIPEDRIVE_API_TOKEN}`;
          const leadPayload = {
            title: `${professional.name} lead`,
            person_id: finalPersonId,
            organization_id: orgId || undefined,
          };

          const leadResponse = await fetch(leadUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(leadPayload),
          });

          const leadResult = await leadResponse.json();
          
          if (leadResult.success) {
            leadId = leadResult.data.id;
            console.log(`📋 Created Lead for ${professional.name} (Lead ID: ${leadId})`);
          } else {
            console.warn(`⚠️ Failed to create Lead for ${professional.name}:`, leadResult.error);
          }
        } else {
          leadId = existingLeadData.data[0].id;
          console.log(`📋 Lead already exists for ${professional.name} (Lead ID: ${leadId})`);
        }
      } catch (leadErr) {
        console.warn(`⚠️ Lead creation error for ${professional.name}:`, getErrorMessage(leadErr));
        // Don't fail the whole sync if Lead creation fails
      }
    }

    return new Response(
      JSON.stringify({ success: true, action, personId: finalPersonId, leadId, hash: currentHash }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Sync error:", err);
    return new Response(
      JSON.stringify({ success: false, error: getErrorMessage(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
