import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PIPEDRIVE_API_TOKEN = Deno.env.get('PIPEDRIVE_API_TOKEN');
const PIPEDRIVE_DOMAIN = Deno.env.get('PIPEDRIVE_DOMAIN');

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      fieldName, 
      profileLink, 
      professionalName, 
      professionalEmail,
      pipedrivePersonId,
      changeRequest 
    } = await req.json();

    console.log('📝 Creating Pipedrive task for field change request:', {
      fieldName,
      professionalName,
      pipedrivePersonId
    });

    if (!PIPEDRIVE_API_TOKEN || !PIPEDRIVE_DOMAIN) {
      throw new Error('Pipedrive credentials not configured');
    }

    // Build task subject and note
    const taskSubject = `Profile Change Request: ${fieldName} - ${professionalName}`;
    
    const taskNote = `
**Field Change Request**

**Agent Name:** ${professionalName}
**Email:** ${professionalEmail || 'Not provided'}
**Field:** ${fieldName}
**Profile Link:** ${profileLink}

**Change Request:**
${changeRequest}

---
*Submitted via Top10Lists.us self-service portal*
    `.trim();

    // Create activity (task) in Pipedrive using v2 API
    const activityData: Record<string, any> = {
      subject: taskSubject,
      type: 'task',
      public_description: taskNote,
      due_date: new Date().toISOString().split('T')[0], // Today
      due_time: '09:00',
      done: false // v2 uses boolean instead of 0/1
    };

    // Link to person if we have their Pipedrive ID
    if (pipedrivePersonId) {
      activityData.person_id = Number(pipedrivePersonId); // v2 requires numeric type
    }

    console.log('📤 Creating Pipedrive activity (v2 API):', activityData);

    const response = await fetch(
      `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v2/activities?api_token=${PIPEDRIVE_API_TOKEN}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(activityData)
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      console.error('❌ Pipedrive API error:', result);
      throw new Error(result.error || 'Failed to create Pipedrive task');
    }

    console.log('✅ Pipedrive task created:', result.data?.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        activityId: result.data?.id,
        message: 'Task created successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('❌ Error creating Pipedrive task:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create task';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
