import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const imagePath = url.searchParams.get("path");

    if (!imagePath) {
      return new Response(
        JSON.stringify({ error: "Missing path parameter" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Extract professional ID (remove .svg extension if present)
    const professionalId = imagePath.replace(/\.svg$/, '');
    
    console.log(`Generating OG image for professional: ${professionalId}`);

    // Call the generate-og-image function to get the SVG
    const generateResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-og-image?id=${professionalId}`,
      {
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
      }
    );

    if (!generateResponse.ok) {
      console.error("Error generating OG image:", await generateResponse.text());
      return new Response(
        JSON.stringify({ error: "Failed to generate image" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const svgData = await generateResponse.text();

    // Return the SVG with appropriate headers
    return new Response(svgData, {
      headers: {
        ...corsHeaders,
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error: any) {
    console.error("Error in og-image-proxy:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
