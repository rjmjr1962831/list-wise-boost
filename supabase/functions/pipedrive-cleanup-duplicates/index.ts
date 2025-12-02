import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PIPEDRIVE_API_TOKEN = Deno.env.get("PIPEDRIVE_API_TOKEN")!;
const PIPEDRIVE_DOMAIN = Deno.env.get("PIPEDRIVE_DOMAIN")!;

interface Contact {
  id: number;
  name: string;
  email: string;
  dealsCount: number;
  activitiesCount: number;
  notesCount: number;
  updateTime?: string;
}

// Fetch all contacts using v2 cursor-based pagination (50% fewer tokens)
async function getAllContacts(): Promise<Contact[]> {
  const contacts: Contact[] = [];
  let cursor: string | null = null;
  const limit = 100;

  console.log("📥 Fetching all contacts from Pipedrive (v2 API with cursor pagination)...");

  do {
    const url = new URL(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v2/persons`);
    url.searchParams.set('api_token', PIPEDRIVE_API_TOKEN);
    url.searchParams.set('limit', String(limit));
    // Request only fields we need to reduce payload
    url.searchParams.set('include_fields', 'open_deals_count,activities_count,notes_count');
    if (cursor) {
      url.searchParams.set('cursor', cursor);
    }

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.success && data.data && data.data.length > 0) {
      for (const person of data.data) {
        // v2 uses different email structure
        const primaryEmail = person.emails?.find((e: any) => e.primary)?.value || 
                            person.emails?.[0]?.value;
        if (primaryEmail) {
          contacts.push({
            id: person.id,
            name: person.name,
            email: primaryEmail.toLowerCase(),
            dealsCount: person.open_deals_count || 0,
            activitiesCount: person.activities_count || 0,
            notesCount: person.notes_count || 0,
            updateTime: person.update_time,
          });
        }
      }
      
      // v2 uses next_cursor instead of pagination.more_items_in_collection
      cursor = data.additional_data?.next_cursor || null;
      console.log(`   Fetched ${contacts.length} contacts so far...`);
      
      // Rate limit: wait between requests
      await new Promise(resolve => setTimeout(resolve, 250));
    } else {
      cursor = null;
    }
  } while (cursor);

  console.log(`✅ Fetched ${contacts.length} total contacts`);
  return contacts;
}

function findDuplicates(contacts: Contact[]): Map<string, Contact[]> {
  const emailMap = new Map<string, Contact[]>();
  
  for (const contact of contacts) {
    const existing = emailMap.get(contact.email) || [];
    existing.push(contact);
    emailMap.set(contact.email, existing);
  }

  // Filter to only emails with duplicates
  const duplicates = new Map<string, Contact[]>();
  for (const [email, contactList] of emailMap.entries()) {
    if (contactList.length > 1) {
      duplicates.set(email, contactList);
    }
  }

  return duplicates;
}

function selectPrimaryContact(contacts: Contact[]): { primary: Contact; duplicates: Contact[] } {
  // Sort by data richness: deals > activities > notes > oldest ID
  const sorted = [...contacts].sort((a, b) => {
    if (a.dealsCount !== b.dealsCount) {
      return b.dealsCount - a.dealsCount;
    }
    if (a.activitiesCount !== b.activitiesCount) {
      return b.activitiesCount - a.activitiesCount;
    }
    if (a.notesCount !== b.notesCount) {
      return b.notesCount - a.notesCount;
    }
    return a.id - b.id;
  });

  return {
    primary: sorted[0],
    duplicates: sorted.slice(1),
  };
}

// v2 API uses PATCH method instead of PUT for merge
async function mergeContact(primaryId: number, duplicateId: number): Promise<boolean> {
  try {
    const url = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v2/persons/${primaryId}/merge?api_token=${PIPEDRIVE_API_TOKEN}`;
    const response = await fetch(url, {
      method: "PATCH", // Changed from PUT to PATCH for v2
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merge_with_id: duplicateId }),
    });

    const result = await response.json();

    if (result.success) {
      return true;
    } else {
      // Check if already deleted
      if (result.error && typeof result.error === "string" && result.error.includes("deleted")) {
        console.log(`⚠️ Contact ${duplicateId} already deleted, skipping`);
        return true;
      }
      console.error(`❌ Failed to merge ${duplicateId} into ${primaryId}:`, result.error);
      return false;
    }
  } catch (error) {
    console.error(`Error merging ${duplicateId}:`, error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dry_run = false } = await req.json().catch(() => ({ dry_run: false }));

    console.log(`🚀 Starting Pipedrive duplicate cleanup (${dry_run ? 'DRY RUN' : 'LIVE MODE'}) - v2 API`);

    // Step 1: Fetch all contacts
    const allContacts = await getAllContacts();

    // Step 2: Find duplicates
    const duplicateGroups = findDuplicates(allContacts);
    console.log(`🔍 Found ${duplicateGroups.size} emails with duplicates`);

    if (duplicateGroups.size === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No duplicates found",
          stats: {
            totalContacts: allContacts.length,
            duplicateEmails: 0,
            duplicateContacts: 0,
            merged: 0,
            failed: 0,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Merge duplicates
    const results = {
      totalContacts: allContacts.length,
      duplicateEmails: duplicateGroups.size,
      duplicateContacts: 0,
      merged: 0,
      failed: 0,
      errors: [] as any[],
      mergeDetails: [] as any[],
    };

    for (const [email, contacts] of duplicateGroups.entries()) {
      results.duplicateContacts += contacts.length - 1;

      const { primary, duplicates } = selectPrimaryContact(contacts);
      
      console.log(`\n📧 Processing ${email}: ${contacts.length} contacts`);
      console.log(`   Primary: ID ${primary.id} (${primary.name})`);
      console.log(`   Duplicates: ${duplicates.map(d => `ID ${d.id}`).join(", ")}`);

      const mergeDetail = {
        email,
        primary: { id: primary.id, name: primary.name },
        duplicates: duplicates.map(d => ({ id: d.id, name: d.name })),
        merged: [] as number[],
        failed: [] as number[],
      };

      if (!dry_run) {
        for (const duplicate of duplicates) {
          const success = await mergeContact(primary.id, duplicate.id);
          if (success) {
            results.merged++;
            mergeDetail.merged.push(duplicate.id);
            console.log(`   ✅ Merged ID ${duplicate.id} into ${primary.id}`);
          } else {
            results.failed++;
            mergeDetail.failed.push(duplicate.id);
            results.errors.push({
              email,
              primaryId: primary.id,
              duplicateId: duplicate.id,
              error: "Merge failed",
            });
          }
          
          // Rate limit: 250ms between merges
          await new Promise(resolve => setTimeout(resolve, 250));
        }
      } else {
        console.log(`   [DRY RUN] Would merge ${duplicates.length} contacts`);
        mergeDetail.merged = duplicates.map(d => d.id);
        results.merged += duplicates.length;
      }

      results.mergeDetails.push(mergeDetail);
    }

    console.log(`\n✅ Cleanup complete:`);
    console.log(`   Total contacts: ${results.totalContacts}`);
    console.log(`   Duplicate emails: ${results.duplicateEmails}`);
    console.log(`   Duplicate contacts: ${results.duplicateContacts}`);
    console.log(`   Merged: ${results.merged}`);
    console.log(`   Failed: ${results.failed}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: dry_run 
          ? `Dry run complete: would merge ${results.merged} duplicates`
          : `Merged ${results.merged} duplicates, ${results.failed} failed`,
        stats: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("❌ Cleanup error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
