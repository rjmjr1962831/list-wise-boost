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

interface DuplicateContact {
  id: number;
  name: string;
  add_time: string;
  professional_id?: string;
  data_richness?: number;
}

interface DuplicateGroup {
  email: string;
  contacts: DuplicateContact[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, duplicates, cleanupMethod = 'delete' } = await req.json();

    if (action === "scan") {
      console.log("🔍 Starting duplicate scan...");

      // Get all professionals with emails
      const { data: professionals, error } = await supabase
        .from("professionals")
        .select("id, email, name")
        .not("email", "is", null)
        .eq("active", true);

      if (error) throw error;

      console.log(`Found ${professionals.length} professionals with emails`);

      // Group by email
      const emailGroups = new Map<string, typeof professionals>();
      professionals.forEach(prof => {
        const email = prof.email!.toLowerCase();
        if (!emailGroups.has(email)) {
          emailGroups.set(email, []);
        }
        emailGroups.get(email)!.push(prof);
      });

      // Search Pipedrive for duplicates
      const duplicateGroups: DuplicateGroup[] = [];
      let scannedCount = 0;

      for (const [email, profs] of emailGroups.entries()) {
        scannedCount++;
        
        if (scannedCount % 10 === 0) {
          console.log(`Progress: ${scannedCount}/${emailGroups.size}`);
        }

        const url = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v2/persons/search?term=${encodeURIComponent(email)}&fields=email&exact_match=true&api_token=${PIPEDRIVE_API_TOKEN}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.success && data.data?.items && data.data.items.length > 1) {
          const contacts = data.data.items.map((item: any) => ({
            id: item.item?.id ?? item.id,
            name: item.item?.name ?? item.name,
            add_time: item.item?.add_time ?? item.add_time,
            professional_id: profs[0]?.id
          }));

          duplicateGroups.push({
            email,
            contacts
          });
        }

        // Rate limit: 250ms between requests (4 per second)
        await new Promise(resolve => setTimeout(resolve, 250));
      }

      console.log(`✅ Scan complete: found ${duplicateGroups.length} duplicate groups`);

      return new Response(
        JSON.stringify({ success: true, duplicates: duplicateGroups }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "cleanup") {
      console.log(`🧹 Starting cleanup of ${duplicates.length} duplicate groups (method: ${cleanupMethod})...`);

      if (!duplicates || !Array.isArray(duplicates)) {
        throw new Error("Duplicates array is required for cleanup");
      }

      let successCount = 0;
      let failCount = 0;

      for (const group of duplicates as DuplicateGroup[]) {
        console.log(`Cleaning ${group.email}...`);

        // Sort by data_richness if available, otherwise by add_time
        const sortedContacts = [...group.contacts].sort((a, b) => {
          if (a.data_richness !== undefined && b.data_richness !== undefined) {
            if (b.data_richness !== a.data_richness) {
              return b.data_richness - a.data_richness;
            }
          }
          return new Date(a.add_time).getTime() - new Date(b.add_time).getTime();
        });

        const keepContact = sortedContacts[0];
        const duplicateContacts = sortedContacts.slice(1);

        console.log(`Keeping: ${keepContact.name} (ID: ${keepContact.id})`);
        console.log(`Processing: ${duplicateContacts.length} duplicate(s)`);

        // Process duplicates
        for (const contact of duplicateContacts) {
          try {
            if (cleanupMethod === 'merge') {
              // Use Pipedrive merge API
              const mergeUrl = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v2/persons/${keepContact.id}/merge?api_token=${PIPEDRIVE_API_TOKEN}`;
              const mergeResponse = await fetch(mergeUrl, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ merge_with_id: contact.id }),
              });

              const mergeResult = await mergeResponse.json();

              if (mergeResult.success) {
                console.log(`✅ Merged duplicate ${contact.id} into ${keepContact.id}`);
                successCount++;
              } else {
                console.error(`❌ Failed to merge ${contact.id}:`, mergeResult);
                failCount++;
              }
            } else {
              // Delete method
              const deleteUrl = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v2/persons/${contact.id}?api_token=${PIPEDRIVE_API_TOKEN}`;
              const deleteResponse = await fetch(deleteUrl, { method: "DELETE" });
              const deleteResult = await deleteResponse.json();

              if (deleteResult.success) {
                console.log(`✅ Deleted duplicate ${contact.id}`);
                successCount++;
              } else if (deleteResult.error?.includes('already deleted')) {
                console.log(`ℹ️ Contact ${contact.id} already deleted, skipping`);
                successCount++;
              } else {
                console.error(`❌ Failed to delete ${contact.id}:`, deleteResult);
                failCount++;
              }
            }
          } catch (err) {
            console.error(`❌ Error processing ${contact.id}:`, err);
            failCount++;
          }

          // Rate limit
          await new Promise(resolve => setTimeout(resolve, 250));
        }
      }

      console.log(`✅ Cleanup complete: ${successCount} processed, ${failCount} failures`);

      return new Response(
        JSON.stringify({ success: true, successCount, failCount }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Invalid action");
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
