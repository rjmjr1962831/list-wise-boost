import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PipedrivePerson {
  id: number;
  name: string;
  emails: { value: string; primary: boolean }[];
  add_time: string;
  open_deals_count?: number;
  activities_count?: number;
  notes_count?: number;
}

interface DuplicateContact {
  id: number;
  name: string;
  email: string;
  add_time: string;
  data_richness: number; // Score based on deals, activities, notes
}

interface DuplicateGroup {
  email: string;
  contacts: DuplicateContact[];
}

interface NameDuplicateGroup {
  name: string;
  contacts: DuplicateContact[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PIPEDRIVE_API_TOKEN = Deno.env.get('PIPEDRIVE_API_TOKEN');
    const PIPEDRIVE_DOMAIN = Deno.env.get('PIPEDRIVE_DOMAIN');

    if (!PIPEDRIVE_API_TOKEN || !PIPEDRIVE_DOMAIN) {
      throw new Error('Missing Pipedrive configuration');
    }

    const baseUrl = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1`;
    const { scanType = 'email' } = await req.json();

    console.log(`🔍 Starting full Pipedrive ${scanType} duplicate scan...`);

    // Fetch ALL persons from Pipedrive with pagination
    const allPersons: PipedrivePerson[] = [];
    let start = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const url = `${baseUrl}/persons?limit=${limit}&start=${start}&api_token=${PIPEDRIVE_API_TOKEN}`;
      console.log(`📥 Fetching persons: start=${start}`);

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Pipedrive persons fetch error: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Pipedrive API error: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      if (data.data && data.data.length > 0) {
        allPersons.push(...data.data);
        start += limit;
        
        // Check if there are more results
        hasMore = data.additional_data?.pagination?.more_items_in_collection || false;
        
        console.log(`✅ Fetched ${data.data.length} persons (total: ${allPersons.length})`);
        
        // Rate limit: wait 250ms between requests
        await new Promise(resolve => setTimeout(resolve, 250));
      } else {
        hasMore = false;
      }
    }

    console.log(`📊 Total persons fetched: ${allPersons.length}`);

    if (scanType === 'email') {
      // Group by normalized email
      const emailGroups = new Map<string, DuplicateContact[]>();

      for (const person of allPersons) {
        // Get primary email or first email
        const email = person.emails?.[0]?.value;
        if (!email) continue;

        const normalizedEmail = email.toLowerCase().trim();
        
        // Calculate data richness score
        const dataRichness = 
          (person.open_deals_count || 0) * 10 +
          (person.activities_count || 0) * 2 +
          (person.notes_count || 0);

        const contact: DuplicateContact = {
          id: person.id,
          name: person.name,
          email: email,
          add_time: person.add_time,
          data_richness: dataRichness,
        };

        if (!emailGroups.has(normalizedEmail)) {
          emailGroups.set(normalizedEmail, []);
        }
        emailGroups.get(normalizedEmail)!.push(contact);
      }

      // Find groups with 2+ contacts (duplicates)
      const duplicates: DuplicateGroup[] = [];

      for (const [email, contacts] of emailGroups) {
        if (contacts.length > 1) {
          // Sort by data richness (most data first), then by date (oldest first)
          contacts.sort((a, b) => {
            if (b.data_richness !== a.data_richness) {
              return b.data_richness - a.data_richness;
            }
            return new Date(a.add_time).getTime() - new Date(b.add_time).getTime();
          });

          duplicates.push({ email, contacts });
        }
      }

      console.log(`✅ Found ${duplicates.length} email duplicate groups`);

      return new Response(
        JSON.stringify({
          success: true,
          scanType: 'email',
          totalPersons: allPersons.length,
          duplicateGroups: duplicates.length,
          duplicates,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (scanType === 'name') {
      // Group by normalized name
      const nameGroups = new Map<string, DuplicateContact[]>();

      for (const person of allPersons) {
        const normalizedName = person.name.toLowerCase().trim();
        const email = person.emails?.[0]?.value || 'no-email';

        const dataRichness = 
          (person.open_deals_count || 0) * 10 +
          (person.activities_count || 0) * 2 +
          (person.notes_count || 0);

        const contact: DuplicateContact = {
          id: person.id,
          name: person.name,
          email: email,
          add_time: person.add_time,
          data_richness: dataRichness,
        };

        if (!nameGroups.has(normalizedName)) {
          nameGroups.set(normalizedName, []);
        }
        nameGroups.get(normalizedName)!.push(contact);
      }

      // Find groups with 2+ contacts (potential duplicates)
      const duplicates: NameDuplicateGroup[] = [];

      for (const [name, contacts] of nameGroups) {
        if (contacts.length > 1) {
          contacts.sort((a, b) => {
            if (b.data_richness !== a.data_richness) {
              return b.data_richness - a.data_richness;
            }
            return new Date(a.add_time).getTime() - new Date(b.add_time).getTime();
          });

          duplicates.push({ name, contacts });
        }
      }

      console.log(`✅ Found ${duplicates.length} name duplicate groups`);

      return new Response(
        JSON.stringify({
          success: true,
          scanType: 'name',
          totalPersons: allPersons.length,
          duplicateGroups: duplicates.length,
          duplicates,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid scan type. Use "email" or "name"');

  } catch (error) {
    console.error('❌ Scan error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
