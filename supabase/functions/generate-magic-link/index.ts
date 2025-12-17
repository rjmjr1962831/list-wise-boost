import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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
    const pipedriveToken = Deno.env.get('PIPEDRIVE_API_TOKEN')!;
    const pipedriveDomain = Deno.env.get('PIPEDRIVE_DOMAIN')!;
    const appUrl = Deno.env.get('APP_URL') || 'https://top10lists.us';
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { professional_id, pipedrive_person_id } = await req.json();

    if (!professional_id) {
      throw new Error('professional_id is required');
    }

    console.log('🔗 Generating magic link for professional:', professional_id);

    // Fetch professional with short_code
    const { data: existing, error: fetchError } = await supabase
      .from('professionals')
      .select(`
        verification_token, 
        verification_token_expires_at, 
        profile_link, 
        short_code,
        name, 
        email, 
        phone
      `)
      .eq('id', professional_id)
      .single();

    if (fetchError) throw fetchError;

    let token = existing.verification_token;
    let shortCode = existing.short_code;
    let profileLink = existing.profile_link;

    // Generate short code if missing (6 random alphanumeric chars)
    const generateShortCode = (): string => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let result = '';
      for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    // Check if token exists and is valid (not expired or will expire before 2050)
    const hasValidToken = token && existing.verification_token_expires_at && 
      new Date(existing.verification_token_expires_at) > new Date('2050-01-01');

    // Generate short code if needed
    if (!shortCode) {
      shortCode = generateShortCode();
      console.log('🆕 Generated new short_code:', shortCode);
    }

    // Profile link should always use short code format
    const expectedProfileLink = `${appUrl}/p/${shortCode}`;

    if (!hasValidToken || profileLink !== expectedProfileLink) {
      // Generate new permanent token if needed
      if (!hasValidToken) {
        token = crypto.randomUUID();
        console.log('🆕 Creating new permanent token');
      }
      
      const permanentExpiry = new Date('2099-12-31T23:59:59Z');
      profileLink = expectedProfileLink;

      console.log('📝 Updating profile with link:', profileLink);

      const { error: updateError } = await supabase
        .from('professionals')
        .update({
          verification_token: token,
          verification_token_expires_at: permanentExpiry.toISOString(),
          verification_started_at: new Date().toISOString(),
          profile_link: profileLink,
          short_code: shortCode
        })
        .eq('id', professional_id);

      if (updateError) throw updateError;
    } else {
      console.log('♻️ Reusing existing token and link');
    }

    // Sync to Pipedrive if pipedrive_person_id provided
    if (pipedrive_person_id && pipedriveToken) {
      console.log('📤 Syncing profile link to Pipedrive person:', pipedrive_person_id);

      // Get Pipedrive field mapping for profile_link
      const { data: fieldMapping } = await supabase
        .from('pipedrive_field_mapping')
        .select('pipedrive_key')
        .eq('field_name', 'profile_link')
        .single();

      if (fieldMapping?.pipedrive_key) {
        const personData: any = {};
        personData[fieldMapping.pipedrive_key] = profileLink;

        const pipedriveResponse = await fetch(
          `https://${pipedriveDomain}.pipedrive.com/api/v2/persons/${pipedrive_person_id}?api_token=${pipedriveToken}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(personData)
          }
        );

        if (!pipedriveResponse.ok) {
          console.error('❌ Failed to update Pipedrive:', await pipedriveResponse.text());
        } else {
          console.log('✅ Synced to Pipedrive');
        }
      } else {
        console.warn('⚠️ profile_link field mapping not found in Pipedrive');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        token,
        profile_link: profileLink,
        professional_name: existing.name,
        is_new_token: !hasValidToken
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error generating magic link:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
