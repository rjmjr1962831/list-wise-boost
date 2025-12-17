import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Professional {
  id: string;
  name: string;
  company: string | null;
  specialty: string[] | null;
  years_experience: number | null;
  city: string;
  state: string;
  category: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { professional_ids } = await req.json();

    if (!professional_ids || !Array.isArray(professional_ids) || professional_ids.length === 0) {
      throw new Error('professional_ids array is required');
    }

    console.log(`Generating bios for ${professional_ids.length} professionals`);

    // Fetch professionals with city and category names
    const { data: professionals, error: fetchError } = await supabase
      .from('professionals')
      .select(`
        id,
        name,
        company,
        specialty,
        years_experience,
        description,
        cities (name, state),
        categories (plural_name)
      `)
      .in('id', professional_ids);

    if (fetchError) throw fetchError;
    if (!professionals || professionals.length === 0) {
      throw new Error('No professionals found');
    }

    const results = [];

    // Generate bios in batches of 5 to avoid rate limits
    for (let i = 0; i < professionals.length; i += 5) {
      const batch = professionals.slice(i, i + 5);
      
      const batchPromises = batch.map(async (prof: any) => {
        try {
          // Skip if already has a description
          if (prof.description && prof.description.trim().length > 50) {
            console.log(`Skipping ${prof.name} - already has bio`);
            return {
              id: prof.id,
              name: prof.name,
              success: false,
              skipped: true,
              message: 'Already has bio'
            };
          }

          const city = prof.cities?.name || 'the area';
          const state = prof.cities?.state || '';
          const category = prof.categories?.plural_name || 'professional';
          const specialties = prof.specialty && Array.isArray(prof.specialty) 
            ? prof.specialty.join(', ') 
            : '';
          const experience = prof.years_experience || null;

          // Create prompt for bio generation
          const prompt = `Write an original, professional bio (2-3 sentences, max 150 words) for ${prof.name}, a ${category.toLowerCase().replace('top10', '').trim()} ${prof.company ? `with ${prof.company}` : ''} serving ${city}, ${state}.
${specialties ? `Specialties: ${specialties}.` : ''}
${experience ? `Experience: ${experience} years.` : ''}

IMPORTANT: Create completely original content. Do NOT copy or paraphrase from Zillow or any other source verbatim.

Bio guidelines:
- Write in your own words using unique phrasing
- Be professional and factual
- Highlight their expertise and service area
- Avoid marketing hyperbole or superlatives
- Do not make claims about being "#1" or "best"
- Focus on their professional approach and what they offer clients

Write only the bio, no preamble.`;

          console.log(`Generating bio for ${prof.name}...`);

          // Call Lovable AI Gateway
          const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${lovableApiKey}`,
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                {
                  role: 'user',
                  content: prompt
                }
              ],
              temperature: 0.7,
              max_tokens: 300
            })
          });

          if (!aiResponse.ok) {
            const errorText = await aiResponse.text();
            throw new Error(`AI API error: ${aiResponse.status} - ${errorText}`);
          }

          const aiData = await aiResponse.json();
          const generatedBio = aiData.choices[0]?.message?.content?.trim();

          if (!generatedBio) {
            throw new Error('No bio generated');
          }

          // Update professional with generated bio
          const { error: updateError } = await supabase
            .from('professionals')
            .update({ description: generatedBio })
            .eq('id', prof.id);

          if (updateError) throw updateError;

          console.log(`Successfully generated bio for ${prof.name}`);

          return {
            id: prof.id,
            name: prof.name,
            bio: generatedBio,
            success: true
          };
        } catch (error: any) {
          console.error(`Error generating bio for ${prof.name}:`, error);
          return {
            id: prof.id,
            name: prof.name,
            success: false,
            error: error.message
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches
      if (i + 5 < professionals.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const successCount = results.filter(r => r.success).length;
    const skippedCount = results.filter(r => r.skipped).length;
    const failedCount = results.filter(r => !r.success && !r.skipped).length;

    console.log(`Completed: ${successCount} success, ${skippedCount} skipped, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        summary: {
          total: professionals.length,
          success: successCount,
          skipped: skippedCount,
          failed: failedCount
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
