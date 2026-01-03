import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PIPEDRIVE_API_TOKEN = Deno.env.get("PIPEDRIVE_API_TOKEN")!;
const PIPEDRIVE_DOMAIN = Deno.env.get("PIPEDRIVE_DOMAIN") || "top10lists";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const extractMissingColumnName = (err: unknown): string | null => {
  const anyErr = err as any;
  const msg = `${anyErr?.message ?? ""} ${anyErr?.details ?? ""}`;
  const m = msg.match(/column\s+"([^"]+)"\s+does\s+not\s+exist/i);
  return m?.[1] ?? null;
};

const safeUpdateProfessional = async (
  professionalId: string,
  updatePayload: Record<string, any>
) => {
  // If PostgREST rejects an unknown column (stale pipedrive_field_mapping),
  // remove that key and retry so the whole sync doesn't fail.
  let payload = { ...updatePayload };
  const removedKeys: string[] = [];

  for (let attempt = 0; attempt < 6; attempt++) {
    const { error } = await supabase
      .from("professionals")
      .update(payload)
      .eq("id", professionalId);

    if (!error) return { removedKeys };

    const missingCol = extractMissingColumnName(error);
    if (missingCol && Object.prototype.hasOwnProperty.call(payload, missingCol)) {
      removedKeys.push(missingCol);
      delete payload[missingCol];

      // Best-effort cleanup so we don't hit the same error again.
      try {
        await supabase.from("pipedrive_field_mapping").delete().eq("field_name", missingCol);
      } catch (_e) {
        // ignore
      }

      // Continue retry loop with smaller payload
      continue;
    }

    console.error("Update error:", error);
    throw error;
  }

  throw new Error(
    `Failed to update professional after removing invalid keys: ${removedKeys.join(", ")}`
  );
};

/**
 * Fetch data from Pipedrive and sync to Supabase
 * Used for manual syncing when webhook didn't fire
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      mode,
      limit,
      offset,
      professional_id,
      pipedrive_person_id,
    }: {
      mode?: string;
      limit?: number;
      offset?: number;
      professional_id?: string;
      pipedrive_person_id?: number;
    } = body;

    // ---------------------------------------------------------------------
    // Batch one-off backfill: fill missing synthesized_bio for ACTIVE + QUALIFIED
    // ---------------------------------------------------------------------
    if (mode === "backfill_missing_synthesized_bio") {
      const limitSafe = Math.min(Math.max(Number(limit) || 10, 1), 100);
      const offsetSafe = Math.max(Number(offset) || 0, 0);

      // Find the Pipedrive key that stores synthesized_bio
      const { data: bioMappings, error: bioMappingError } = await supabase
        .from("pipedrive_field_mapping")
        .select("field_name, pipedrive_key")
        .ilike("field_name", "%synthesized%")
        .limit(10);

      if (bioMappingError) {
        console.error("Mapping lookup error:", bioMappingError);
        throw bioMappingError;
      }

      const bioKey =
        bioMappings?.find((m) => m.field_name === "synthesized_bio")?.pipedrive_key ||
        bioMappings?.[0]?.pipedrive_key;

      if (!bioKey) {
        return new Response(
          JSON.stringify({
            error:
              "No Pipedrive mapping found for synthesized bio. Expected a pipedrive_field_mapping row with field_name = synthesized_bio.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Count remaining (for progress)
      const { count: totalRemaining, error: countError } = await supabase
        .from("professionals")
        .select("id", { count: "exact", head: true })
        .eq("active", true)
        .gte("review_stars_rating", 4.8)
        .gte("num_total_reviews", 20)
        .is("synthesized_bio", null);

      if (countError) {
        console.error("Count error:", countError);
        throw countError;
      }

      // Pull a batch of eligible professionals
      const { data: candidates, error: candidatesError } = await supabase
        .from("professionals")
        .select("id, name")
        .eq("active", true)
        .gte("review_stars_rating", 4.8)
        .gte("num_total_reviews", 20)
        .is("synthesized_bio", null)
        .order("updated_at", { ascending: false })
        .range(offsetSafe, offsetSafe + limitSafe - 1);

      if (candidatesError) {
        console.error("Candidates error:", candidatesError);
        throw candidatesError;
      }

      const ids = (candidates || []).map((c) => c.id).filter(Boolean);

      if (ids.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            mode,
            processed: 0,
            updated: 0,
            skipped_no_person_id: 0,
            skipped_no_bio: 0,
            errors: 0,
            offset: offsetSafe,
            next_offset: offsetSafe,
            remaining: totalRemaining ?? 0,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: syncRows, error: syncError } = await supabase
        .from("pipedrive_sync_state")
        .select("professional_id, pipedrive_person_id")
        .in("professional_id", ids);

      if (syncError) {
        console.error("Sync-state lookup error:", syncError);
        throw syncError;
      }

      const personIdByProfessionalId = new Map<string, number>();
      for (const row of syncRows || []) {
        if (row.professional_id && row.pipedrive_person_id) {
          personIdByProfessionalId.set(row.professional_id, row.pipedrive_person_id);
        }
      }

      let updated = 0;
      let skippedNoPerson = 0;
      let skippedNoBio = 0;
      let errors = 0;

      const results: Array<{
        professional_id: string;
        pipedrive_person_id?: number;
        status: "updated" | "skipped_no_person_id" | "skipped_no_bio" | "error";
        error?: string;
      }> = [];

      for (const profId of ids) {
        const personId = personIdByProfessionalId.get(profId);
        if (!personId) {
          skippedNoPerson += 1;
          results.push({ professional_id: profId, status: "skipped_no_person_id" });
          continue;
        }

        try {
          const pipedriveUrl = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v2/persons/${personId}?api_token=${PIPEDRIVE_API_TOKEN}`;
          const response = await fetch(pipedriveUrl, {
            headers: { "Content-Type": "application/json" },
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Pipedrive fetch failed (${response.status}): ${errorText}`);
          }

          const pipedriveData = await response.json();
          const personData = pipedriveData?.data;
          const customFields = personData?.custom_fields || {};

          const bioValue = customFields[bioKey];
          const bio = typeof bioValue === "string" ? bioValue.trim() : "";

          if (!bio) {
            skippedNoBio += 1;
            results.push({
              professional_id: profId,
              pipedrive_person_id: personId,
              status: "skipped_no_bio",
            });
            continue;
          }

          await safeUpdateProfessional(profId, {
            synthesized_bio: bio,
            skip_pipedrive_sync: true,
            updated_at: new Date().toISOString(),
          });

          updated += 1;
          results.push({
            professional_id: profId,
            pipedrive_person_id: personId,
            status: "updated",
          });

          // small delay to reduce burst rate
          await sleep(150);
        } catch (e: any) {
          errors += 1;
          results.push({
            professional_id: profId,
            pipedrive_person_id: personId,
            status: "error",
            error: e?.message || String(e),
          });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          mode,
          processed: ids.length,
          updated,
          skipped_no_person_id: skippedNoPerson,
          skipped_no_bio: skippedNoBio,
          errors,
          offset: offsetSafe,
          next_offset: offsetSafe + limitSafe,
          remaining: totalRemaining ?? 0,
          sample_results: results.slice(0, 25),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------------------------------------------------------------------
    // Single record sync (original behavior)
    // ---------------------------------------------------------------------
    if (!professional_id && !pipedrive_person_id) {
      return new Response(
        JSON.stringify({ error: "professional_id or pipedrive_person_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let personId = pipedrive_person_id;

    // If we have professional_id, look up the pipedrive person ID
    if (!personId && professional_id) {
      const { data: syncState, error: syncStateError } = await supabase
        .from("pipedrive_sync_state")
        .select("pipedrive_person_id")
        .eq("professional_id", professional_id)
        .maybeSingle();

      if (syncStateError) {
        console.error("Sync state lookup error:", syncStateError);
        throw syncStateError;
      }

      personId = syncState?.pipedrive_person_id ?? undefined;
    }

    if (!personId) {
      return new Response(
        JSON.stringify({ error: "No Pipedrive person ID found for this professional" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch person from Pipedrive
    console.log(`Fetching person ${personId} from Pipedrive...`);

    const pipedriveUrl = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v2/persons/${personId}?api_token=${PIPEDRIVE_API_TOKEN}`;
    const response = await fetch(pipedriveUrl, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Pipedrive API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch from Pipedrive", details: errorText }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pipedriveData = await response.json();
    const personData = pipedriveData.data;

    console.log("Pipedrive person data received:", JSON.stringify(personData, null, 2));

    // Get field mappings
    const { data: mappings, error: mappingsError } = await supabase
      .from("pipedrive_field_mapping")
      .select("field_name, pipedrive_key");

    if (mappingsError) {
      console.error("Mappings fetch error:", mappingsError);
      throw mappingsError;
    }

    const fieldMappings: Record<string, string> = {};
    for (const row of mappings || []) {
      fieldMappings[row.pipedrive_key] = row.field_name;
    }

    // Build updates from Pipedrive data
    const updates: Record<string, any> = {};
    const fieldsFound: string[] = [];

    // Core fields
    if (personData?.name) {
      updates.name = personData.name;
      fieldsFound.push("name");
    }

    const email = personData?.emails?.[0]?.value;
    if (email) {
      updates.email = email;
      fieldsFound.push("email");
    }

    const phone = personData?.phones?.[0]?.value;
    if (phone) {
      updates.phone = phone;
      fieldsFound.push("phone");
    }

    // Custom fields - Pipedrive v2 stores these under custom_fields object
    const customFields = personData?.custom_fields || {};

    for (const [pipedriveKey, fieldName] of Object.entries(fieldMappings)) {
      if (
        [
          "name",
          "email",
          "phone",
          "supabase_id",
          "card_url",
          "profile_link",
          "city_name",
          "state",
          "email_verified",
        ].includes(fieldName)
      ) {
        continue;
      }

      const value = customFields[pipedriveKey];

      if (value !== undefined && value !== null && value !== "") {
        fieldsFound.push(`${fieldName}: ${String(value).substring(0, 100)}...`);

        if (fieldName === "specialty") {
          if (typeof value === "string" && value.trim()) {
            updates.specialty = value
              .split(",")
              .map((s: string) => s.trim())
              .filter(Boolean);
          }
        } else if (["years_experience", "total_sales", "current_listings", "rank"].includes(fieldName)) {
          const numValue = parseInt(String(value), 10);
          if (!isNaN(numValue)) {
            updates[fieldName] = numValue;
          }
        } else if (["zillow_rating", "review_stars_rating"].includes(fieldName)) {
          const floatValue = parseFloat(String(value));
          if (!isNaN(floatValue)) {
            // zillow_rating maps to review_stars_rating in database
            updates["review_stars_rating"] = floatValue;
          }
        } else if (typeof value === "string") {
          updates[fieldName] = value.trim();
        }
      }
    }

    // Apply updates to Supabase
    if (Object.keys(updates).length > 0) {
      const profId = professional_id ||
        (await supabase
          .from("pipedrive_sync_state")
          .select("professional_id")
          .eq("pipedrive_person_id", personId)
          .maybeSingle()).data?.professional_id;

      if (profId) {
        const { removedKeys } = await safeUpdateProfessional(profId, {
          ...updates,
          skip_pipedrive_sync: true,
          updated_at: new Date().toISOString(),
        });

        console.log(`Updated professional ${profId} with fields:`, Object.keys(updates));
        if (removedKeys.length > 0) {
          console.warn(`Removed invalid mapped fields during update:`, removedKeys);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        personId,
        fieldsFound,
        updates: Object.keys(updates),
        rawData: personData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

