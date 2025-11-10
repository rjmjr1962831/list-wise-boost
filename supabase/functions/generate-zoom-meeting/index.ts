import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ZoomMeetingRequest {
  appointmentId: string;
  topic: string;
  startTime: string; // ISO 8601 format
  duration: number; // in minutes
  hostEmail?: string;
}

interface ZoomTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface ZoomMeetingResponse {
  id: string;
  join_url: string;
  start_url: string;
  password: string;
}

async function getZoomAccessToken(): Promise<string> {
  const accountId = Deno.env.get("ZOOM_ACCOUNT_ID");
  const clientId = Deno.env.get("ZOOM_CLIENT_ID");
  const clientSecret = Deno.env.get("ZOOM_CLIENT_SECRET");

  if (!accountId || !clientId || !clientSecret) {
    throw new Error("Missing Zoom credentials");
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);
  
  const tokenResponse = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
    {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error("Zoom token error:", errorText);
    throw new Error(`Failed to get Zoom access token: ${errorText}`);
  }

  const tokenData: ZoomTokenResponse = await tokenResponse.json();
  return tokenData.access_token;
}

async function createZoomMeeting(
  accessToken: string,
  topic: string,
  startTime: string,
  duration: number
): Promise<ZoomMeetingResponse> {
  const meetingData = {
    topic,
    type: 2, // Scheduled meeting
    start_time: startTime,
    duration,
    timezone: "America/Phoenix",
    settings: {
      host_video: true,
      participant_video: true,
      join_before_host: false,
      mute_upon_entry: true,
      watermark: false,
      use_pmi: false,
      approval_type: 0, // Automatically approve
      audio: "both",
      auto_recording: "none",
    },
  };

  const meetingResponse = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(meetingData),
  });

  if (!meetingResponse.ok) {
    const errorText = await meetingResponse.text();
    console.error("Zoom meeting creation error:", errorText);
    throw new Error(`Failed to create Zoom meeting: ${errorText}`);
  }

  return await meetingResponse.json();
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { appointmentId, topic, startTime, duration }: ZoomMeetingRequest =
      await req.json();

    console.log("Generating Zoom meeting for appointment:", appointmentId);

    // Get Zoom access token
    const accessToken = await getZoomAccessToken();
    console.log("Successfully obtained Zoom access token");

    // Create Zoom meeting
    const meeting = await createZoomMeeting(
      accessToken,
      topic,
      startTime,
      duration
    );
    console.log("Zoom meeting created:", meeting.id);

    // Update appointment with meeting link
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: updateError } = await supabase
      .from("appointments")
      .update({
        meeting_link: meeting.join_url,
        location: "Zoom Meeting",
      })
      .eq("id", appointmentId);

    if (updateError) {
      console.error("Error updating appointment:", updateError);
      throw updateError;
    }

    console.log("Appointment updated with Zoom link");

    return new Response(
      JSON.stringify({
        success: true,
        meetingId: meeting.id,
        joinUrl: meeting.join_url,
        password: meeting.password,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in generate-zoom-meeting function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
