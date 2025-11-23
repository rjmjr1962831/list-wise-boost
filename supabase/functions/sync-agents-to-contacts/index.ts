import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all active professionals with email addresses
    const { data: professionals, error: fetchError } = await supabase
      .from('professionals')
      .select('*')
      .eq('active', true)
      .not('email', 'is', null)
      .order('created_at', { ascending: false });

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Found ${professionals?.length || 0} professionals with emails`);

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const professional of professionals || []) {
      try {
        // Check if contact already exists with this email
        const { data: existingContact } = await supabase
          .from('contacts')
          .select('id')
          .eq('email', professional.email)
          .maybeSingle();

        if (existingContact) {
          console.log(`Contact already exists for ${professional.email}`);
          skipped++;
          continue;
        }

        // Create contact from professional data
        const contactData = {
          full_name: professional.name,
          email: professional.email,
          phone: professional.phone || null,
          website: professional.website || null,
          message: `Agent from ${professional.company || 'N/A'}. Specialties: ${professional.specialty?.join(', ') || 'N/A'}. Rating: ${professional.review_stars_rating || 'N/A'} (${professional.num_total_reviews || 0} reviews)`,
        };

        const { error: insertError } = await supabase
          .from('contacts')
          .insert(contactData);

        if (insertError) {
          console.error(`Error inserting contact for ${professional.email}:`, insertError);
          errors.push(`${professional.name}: ${insertError.message}`);
        } else {
          console.log(`Created contact for ${professional.name}`);
          created++;
        }
      } catch (error: any) {
        console.error(`Error processing professional ${professional.name}:`, error);
        errors.push(`${professional.name}: ${error.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        created,
        skipped,
        total: professionals?.length || 0,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error syncing agents to contacts:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
