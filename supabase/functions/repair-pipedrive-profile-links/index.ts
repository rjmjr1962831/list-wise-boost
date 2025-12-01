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

async function updateProfileLink(
  personId: number,
  profileLink: string,
  profileLinkFieldKey: string
): Promise<void> {
  const url = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v2/persons/${personId}?api_token=${PIPEDRIVE_API_TOKEN}`;

  const personData: Record<string, any> = {
    [profileLinkFieldKey]: profileLink
  };

  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(personData),
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(`Failed to update person ${personId}: ${JSON.stringify(data)}`);
  }

  console.log(`✅ Updated profile_link for person ${personId}: ${profileLink}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const limit = body.limit || 100;
    const dryRun = body.dry_run || false;

    // Get field mapping for profile_link
    const fieldMapping = await getFieldMapping();
    const profileLinkFieldKey = fieldMapping['profile_link'];

    if (!profileLinkFieldKey) {
      throw new Error("profile_link field mapping not found. Please configure it in the field mappings.");
    }

    console.log(`📋 Using Pipedrive field key: ${profileLinkFieldKey} for profile_link`);

    // Get professionals with profile_link and email
    const { data: professionals, error } = await supabase
      .from("professionals")
      .select("id, name, email, profile_link")
      .not("profile_link", "is", null)
      .not("email", "is", null)
      .eq("active", true)
      .limit(limit);

    if (error) throw error;

    if (!professionals || professionals.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No professionals with profile_link found", 
          updated: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📊 Found ${professionals.length} professionals to process...`);

    const results = { updated: 0, errors: 0, skipped: 0 };
    const errorDetails: string[] = [];

    for (const professional of professionals) {
      try {
        // Search for person in Pipedrive by email
        const personId = await searchPersonByEmail(professional.email);

        if (!personId) {
          console.warn(`⚠️ Skipping ${professional.name}: not found in Pipedrive`);
          results.skipped++;
          continue;
        }

        if (dryRun) {
          console.log(`[DRY RUN] Would update person ${personId} (${professional.name}) with profile_link: ${professional.profile_link}`);
          results.updated++;
        } else {
          await updateProfileLink(personId, professional.profile_link, profileLinkFieldKey);
          results.updated++;
        }

        // Rate limit delay
        await delay(DELAY_MS);
      } catch (error) {
        console.error(`❌ Error updating ${professional.name}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.errors++;
        errorDetails.push(`${professional.name}: ${errorMessage}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: dryRun 
          ? `[DRY RUN] Would update ${results.updated} profile links`
          : `Updated ${results.updated} profile links`,
        dry_run: dryRun,
        profile_link_field_key: profileLinkFieldKey,
        ...results,
        errors: errorDetails.length > 0 ? errorDetails : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Repair error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
