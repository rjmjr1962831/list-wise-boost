import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { cityId, categoryId } = await req.json();
    
    // Get all professionals without images for the given city/category
    const { data: professionals, error: fetchError } = await supabase
      .from('professionals')
      .select('id, name')
      .eq('city_id', cityId)
      .eq('category_id', categoryId)
      .is('image_url', null);

    if (fetchError) throw fetchError;

    console.log(`Generating photos for ${professionals?.length || 0} agents`);

    const results = [];
    
    for (const pro of professionals || []) {
      try {
        // Determine likely gender from name (simple heuristic)
        const firstName = pro.name.split(' ')[0].toLowerCase();
        const maleNames = ['michael', 'david', 'james', 'robert', 'christopher'];
        const femaleNames = ['sarah', 'jennifer', 'lisa', 'amanda', 'maria'];
        let gender = 'person';
        if (maleNames.includes(firstName)) gender = 'male';
        if (femaleNames.includes(firstName)) gender = 'female';

        const imagePrompt = `Professional real estate agent headshot portrait, ${gender}, business attire, friendly smile, office background, high quality, professional lighting, approachable, confident`;
        
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image-preview",
            messages: [{ role: "user", content: imagePrompt }],
            modalities: ["image", "text"]
          })
        });

        if (!aiResponse.ok) {
          console.error(`Failed to generate image for ${pro.name}`);
          continue;
        }

        const aiData = await aiResponse.json();
        const imageUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        
        if (!imageUrl) {
          console.error(`No image URL for ${pro.name}`);
          continue;
        }

        // Convert base64 to blob
        const base64Data = imageUrl.split(',')[1];
        const imageBlob = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        
        // Upload to Supabase Storage
        const fileName = `${pro.id}.png`;
        const { error: uploadError } = await supabase.storage
          .from('professional-photos')
          .upload(fileName, imageBlob, {
            contentType: 'image/png',
            upsert: true
          });

        if (uploadError) {
          console.error(`Upload error for ${pro.name}:`, uploadError);
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('professional-photos')
          .getPublicUrl(fileName);

        // Update professional record
        const { error: updateError } = await supabase
          .from('professionals')
          .update({ image_url: publicUrl })
          .eq('id', pro.id);

        if (updateError) {
          console.error(`Update error for ${pro.name}:`, updateError);
          continue;
        }

        results.push({ name: pro.name, success: true, imageUrl: publicUrl });
        console.log(`✓ Generated photo for ${pro.name}`);
        
      } catch (error: any) {
        console.error(`Error processing ${pro.name}:`, error.message);
        results.push({ name: pro.name, success: false, error: error.message });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        total: professionals?.length || 0,
        generated: results.filter(r => r.success).length,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in bulk photo generation:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
