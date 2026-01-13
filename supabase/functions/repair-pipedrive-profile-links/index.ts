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

const DELAY_MS = 50; // Faster since we're not searching
const BATCH_SIZE = 1000;

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
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const dryRun = body.dry_run || false;

    // Get field mapping for profile_link
    const fieldMapping = await getFieldMapping();
    const profileLinkFieldKey = fieldMapping['profile_link'];

    if (!profileLinkFieldKey) {
      throw new Error("profile_link field mapping not found. Please configure it in the field mappings.");
    }

    console.log(`📋 Using Pipedrive field key: ${profileLinkFieldKey} for profile_link`);

    const results = { updated: 0, errors: 0, skipped: 0, total: 0 };
    const errorDetails: string[] = [];
    let offset = 0;
    let hasMore = true;

    // Paginate through ALL active qualified professionals who have a pipedrive_person_id
    while (hasMore) {
      // Join professionals with pipedrive_sync_state to get the person ID directly
      // Per project knowledge: Sync Criteria requires email IS NOT NULL and email != ''
      const { data: syncRecords, error } = await supabase
        .from("pipedrive_sync_state")
        .select(`
          pipedrive_person_id,
          professional:professionals!inner(
            id,
            name,
            email,
            profile_link,
            active,
            review_stars_rating,
            num_total_reviews
          )
        `)
        .not("pipedrive_person_id", "is", null)
        .range(offset, offset + BATCH_SIZE - 1);

      if (error) throw error;

      if (!syncRecords || syncRecords.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`📊 Processing batch ${offset / BATCH_SIZE + 1}: ${syncRecords.length} records...`);

      for (const record of syncRecords) {
        const professional = record.professional as any;
        const personId = record.pipedrive_person_id;

        results.total++;

        // Skip if no pipedrive_person_id
        if (!personId) {
          results.skipped++;
          continue;
        }

        // Skip if not active or doesn't meet qualifications (per project knowledge Sync Criteria)
        // Required: active=true, 4.8+ rating, 20+ reviews, email not null/empty
        if (!professional.active || 
            professional.review_stars_rating < 4.8 || 
            professional.num_total_reviews < 20 ||
            !professional.email || professional.email.trim() === '') {
          results.skipped++;
          continue;
        }

        // Skip if no profile_link
        if (!professional.profile_link) {
          results.skipped++;
          continue;
        }

        try {
          // Ensure profile_link uses www domain (per project requirements)
          let normalizedLink = professional.profile_link;
          if (normalizedLink && normalizedLink.includes('https://top10lists.us/')) {
            normalizedLink = normalizedLink.replace('https://top10lists.us/', 'https://www.top10lists.us/');
          }

          if (dryRun) {
            console.log(`[DRY RUN] Would update person ${personId} (${professional.name}) with profile_link: ${normalizedLink}`);
            results.updated++;
          } else {
            await updateProfileLink(personId, normalizedLink, profileLinkFieldKey);
            results.updated++;
            
            // Log progress every 100 updates
            if (results.updated % 100 === 0) {
              console.log(`✅ Progress: ${results.updated} updated...`);
            }
          }

          // Rate limit delay
          await delay(DELAY_MS);
        } catch (error) {
          console.error(`❌ Error updating ${professional.name}:`, error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          results.errors++;
          if (errorDetails.length < 20) {
            errorDetails.push(`${professional.name}: ${errorMessage}`);
          }
        }
      }

      // Check if we got a full batch (meaning there might be more)
      if (syncRecords.length < BATCH_SIZE) {
        hasMore = false;
      } else {
        offset += BATCH_SIZE;
      }
    }

    console.log(`🏁 Completed: ${results.updated} updated, ${results.skipped} skipped, ${results.errors} errors out of ${results.total} total`);

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
