import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApplicationRequest {
  firstName: string;
  lastName: string;
  email: string;
  state: string;
  licenseNumber: string;
  note?: string | null;
  professionalId?: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const pipedriveApiKey = Deno.env.get('PIPEDRIVE_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ApplicationRequest = await req.json();
    const { firstName, lastName, email, state, licenseNumber, note, professionalId } = body;

    console.log('Creating agent application:', { firstName, lastName, email, state, licenseNumber });

    // Check for existing application with same email + license
    const { data: existingApp } = await supabase
      .from('agent_applications')
      .select('id, status')
      .eq('email', email)
      .eq('license_number', licenseNumber)
      .single();

    if (existingApp) {
      console.log('Existing application found:', existingApp);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Application already exists',
          status: existingApp.status 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get professional profile URL if professionalId exists
    let profileUrl = null;
    if (professionalId) {
      const { data: professional } = await supabase
        .from('professionals')
        .select('canonical_slug, state_slug')
        .eq('id', professionalId)
        .single();

      if (professional?.canonical_slug && professional?.state_slug) {
        profileUrl = `https://www.top10lists.us/${professional.state_slug}/${professional.canonical_slug}`;
      }
    }

    // Create application record
    const { data: application, error: appError } = await supabase
      .from('agent_applications')
      .insert({
        full_name: `${firstName} ${lastName}`,
        email,
        state,
        license_number: licenseNumber,
        bio: note || '',
        status: 'pending',
        phone: '', // Required field
        brokerage_name: '', // Required field
        website: '', // Required field
      })
      .select()
      .single();

    if (appError) {
      console.error('Error creating application:', appError);
      throw new Error(`Failed to create application: ${appError.message}`);
    }

    console.log('Application created:', application.id);

    // Create Pipedrive task if API key is available
    if (pipedriveApiKey) {
      try {
        const taskTitle = 'Agent listing review request';
        const taskDescription = `
Agent Name: ${firstName} ${lastName}
Email: ${email}
State: ${state}
License Number: ${licenseNumber}
${note ? `Note: ${note}` : ''}
${profileUrl ? `Profile: ${profileUrl}` : ''}
Application ID: ${application.id}
        `.trim();

        // First, create or find the person in Pipedrive
        const searchResponse = await fetch(
          `https://api.pipedrive.com/v1/persons/search?term=${encodeURIComponent(email)}&api_token=${pipedriveApiKey}`
        );
        const searchData = await searchResponse.json();

        let personId = searchData.data?.items?.[0]?.item?.id;

        if (!personId) {
          // Create new person
          const personResponse = await fetch(
            `https://api.pipedrive.com/v1/persons?api_token=${pipedriveApiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: `${firstName} ${lastName}`,
                email: [{ value: email, primary: true }],
              }),
            }
          );
          const personData = await personResponse.json();
          personId = personData.data?.id;
        }

        if (personId) {
          // Create activity (task) linked to person
          const activityResponse = await fetch(
            `https://api.pipedrive.com/v1/activities?api_token=${pipedriveApiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                subject: taskTitle,
                type: 'task',
                person_id: personId,
                note: taskDescription,
                due_date: new Date().toISOString().split('T')[0],
                done: 0,
              }),
            }
          );
          const activityData = await activityResponse.json();
          console.log('Pipedrive activity created:', activityData.data?.id);
        }
      } catch (pipedriveError) {
        console.error('Pipedrive integration error:', pipedriveError);
        // Don't fail the request if Pipedrive fails
      }
    } else {
      console.log('PIPEDRIVE_API_KEY not configured, skipping Pipedrive integration');
    }

    return new Response(
      JSON.stringify({ success: true, applicationId: application.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('create-agent-application error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
