import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PIPEDRIVE_API_TOKEN = Deno.env.get("PIPEDRIVE_API_TOKEN");
const PIPEDRIVE_DOMAIN = Deno.env.get("PIPEDRIVE_DOMAIN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface FieldDefinition {
  field_name: string;
  pipedrive_name: string;
  field_type: "varchar" | "text" | "double" | "date" | "enum";
  options?: string[];
}

const FIELDS_TO_CREATE: FieldDefinition[] = [
  { field_name: "profile_link", pipedrive_name: "Profile Link", field_type: "varchar" },
  { field_name: "current_listings", pipedrive_name: "Current Listings", field_type: "double" },
  { field_name: "total_sales", pipedrive_name: "Total Sales", field_type: "double" },
  { field_name: "license_number", pipedrive_name: "License Number", field_type: "varchar" },
  { field_name: "rank", pipedrive_name: "Rank", field_type: "double" },
  { field_name: "synthesized_bio", pipedrive_name: "Synthesized Bio", field_type: "text" },
  { field_name: "is_top_agent", pipedrive_name: "Top Agent", field_type: "enum", options: ["Yes", "No"] },
  { field_name: "is_premier_agent", pipedrive_name: "Premier Agent", field_type: "enum", options: ["Yes", "No"] },
  { field_name: "city_name", pipedrive_name: "City", field_type: "varchar" },
  { field_name: "state", pipedrive_name: "State", field_type: "varchar" },
];

async function createPipedriveField(field: FieldDefinition): Promise<string | null> {
  try {
    const url = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v2/personFields?api_token=${PIPEDRIVE_API_TOKEN}`;
    
    const body: any = {
      field_name: field.pipedrive_name,
      field_type: field.field_type,
    };

    if (field.options) {
      body.options = field.options;
    }

    console.log(`Creating Pipedrive field: ${field.pipedrive_name}`);
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to create field ${field.pipedrive_name}:`, errorText);
      throw new Error(`Pipedrive API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`Created field ${field.pipedrive_name} with key: ${data.data.key}`);
    
    return data.data.key;
  } catch (error) {
    console.error(`Error creating field ${field.pipedrive_name}:`, error);
    return null;
  }
}

async function storeMappingInDatabase(fieldName: string, pipedriveKey: string) {
  const { error } = await supabase
    .from("pipedrive_field_mapping")
    .insert({
      field_name: fieldName,
      pipedrive_key: pipedriveKey,
    });

  if (error) {
    console.error(`Failed to store mapping for ${fieldName}:`, error);
    throw error;
  }

  console.log(`Stored mapping: ${fieldName} -> ${pipedriveKey}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting Pipedrive field creation process...");

    const results = {
      created: [] as { field_name: string; pipedrive_key: string }[],
      failed: [] as { field_name: string; error: string }[],
    };

    // Create each field in Pipedrive
    for (const field of FIELDS_TO_CREATE) {
      try {
        const pipedriveKey = await createPipedriveField(field);
        
        if (pipedriveKey) {
          // Store mapping in database
          await storeMappingInDatabase(field.field_name, pipedriveKey);
          results.created.push({
            field_name: field.field_name,
            pipedrive_key: pipedriveKey,
          });
        } else {
          results.failed.push({
            field_name: field.field_name,
            error: "Failed to create field in Pipedrive",
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.failed.push({
          field_name: field.field_name,
          error: errorMessage,
        });
      }

      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log("Field creation process completed");
    console.log(`Created: ${results.created.length}, Failed: ${results.failed.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Created ${results.created.length} fields, ${results.failed.length} failed`,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
