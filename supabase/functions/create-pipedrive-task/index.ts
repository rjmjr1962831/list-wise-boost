import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
      professionalId,
      pipedrivePersonId,
      changeRequest,
      currentValue,
      proposedValue
    } = await req.json();

    console.log('📝 Creating Pipedrive task for field change request:', {
      fieldName,
      professionalName,
      professionalId,
      pipedrivePersonId,
      hasCurrentValue: !!currentValue,
      hasProposedValue: !!proposedValue
    });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let pipedriveActivityId: number | null = null;

    // Create Pipedrive task if credentials are available
    if (PIPEDRIVE_API_TOKEN && PIPEDRIVE_DOMAIN) {
      // Build task subject and note
      const taskSubject = `Profile Change Request: ${fieldName} - ${professionalName}`;
      
      const taskNote = `
═══════════════════════════════════════
SOURCE: Agent Self-Service Portal
Field change request from existing agent
═══════════════════════════════════════

AGENT: ${professionalName}
EMAIL: ${professionalEmail || 'Not provided'}
FIELD: ${fieldName}
PROFILE: ${profileLink}

─── CHANGE REQUEST ───
${changeRequest}

${currentValue ? `─── CURRENT VALUE ───
${currentValue.substring(0, 500)}${currentValue.length > 500 ? '...' : ''}` : ''}

${proposedValue ? `─── PROPOSED VALUE ───
${proposedValue.substring(0, 500)}${proposedValue.length > 500 ? '...' : ''}` : ''}

Review in Admin: Field Change Requests tab
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

      if (response.ok && result.success) {
        pipedriveActivityId = result.data?.id;
        console.log('✅ Pipedrive task created:', pipedriveActivityId);
      } else {
        console.error('⚠️ Pipedrive API error (non-fatal):', result);
      }
    }

    // Store the request in the database
    if (professionalId) {
      const { error: dbError } = await supabase
        .from('field_change_requests')
        .insert({
          professional_id: professionalId,
          field_name: fieldName,
          current_value: currentValue || null,
          proposed_value: proposedValue || null,
          change_request: changeRequest,
          status: 'pending',
          pipedrive_activity_id: pipedriveActivityId
        });

      if (dbError) {
        console.error('⚠️ Database insert error (non-fatal):', dbError);
      } else {
        console.log('✅ Change request stored in database');
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        activityId: pipedriveActivityId,
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
