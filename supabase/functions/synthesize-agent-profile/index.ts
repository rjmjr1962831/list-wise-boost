import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { professionalId, rawResearch, skipIfNoPress = false } = await req.json();

    // Note: skipIfNoPress is now false by default to ensure achievements are always extracted
    // Even without press research, we can extract achievements from existing bio data
    if (skipIfNoPress && (!rawResearch || rawResearch.trim().length < 100)) {
      console.log('⏭️ Skipping synthesis - no substantial press research found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          skipped: true, 
          reason: 'no_press_mentions'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!professionalId) {
      throw new Error('professionalId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Fetch existing professional data
    const { data: professional, error: fetchError } = await supabase
      .from('professionals')
      .select('*')
      .eq('id', professionalId)
      .single();

    if (fetchError) throw fetchError;

    // Prepare context for AI - gather all available data sources
    const context = {
      name: professional.name,
      existingBio: professional.get_to_know_me || professional.description,
      existingPressData: professional.press_mentions || [],
      rawResearch: rawResearch || '',
      professionalInformation: professional.professional_information || {},
      // Additional data that might contain achievements
      yearsExperience: professional.years_experience,
      badges: professional.badges || [],
      specialty: professional.specialty || [],
      reviewCount: professional.num_total_reviews,
      rating: professional.review_stars_rating
    };

    console.log('📝 Synthesizing profile for:', professional.name);
    console.log(`   Bio length: ${(context.existingBio || '').length} chars`);
    console.log(`   Press mentions: ${context.existingPressData.length}`);
    console.log(`   Raw research: ${context.rawResearch.length} chars`);

    // Call Lovable AI with tool calling for structured extraction
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a professional profile synthesizer. Your job is to extract structured data from existing profile data, press research, and any available information.

CRITICAL RULES:
1. Convert all first-person language to third-person
2. ALWAYS extract achievements from existing bio data, even without press research
3. Look for: awards, certifications, sales milestones, years of experience, specializations
4. Rank achievements by credibility (1-10): existing bio = 5-7, press mentions = 8-10
5. Deduplicate information across sources
6. Extract only factual, concrete information
7. Keep descriptions concise but informative

IMPORTANT: Even if no press research is provided, you MUST extract achievements from the existing bio and profile data.`
          },
          {
            role: 'user',
            content: `Synthesize this agent profile:\n\nName: ${context.name}\n\nExisting Bio:\n${context.existingBio || 'No bio available'}\n\nProfile Information:\n${JSON.stringify(context.professionalInformation, null, 2)}\n\nYears Experience: ${context.yearsExperience || 'Unknown'}\nBadges: ${context.badges.join(', ') || 'None'}\nSpecialties: ${context.specialty.join(', ') || 'None'}\nReviews: ${context.reviewCount || 0} reviews (${context.rating || 0} stars)\n\nRaw Press Research:\n${context.rawResearch || 'No press research available'}\n\nExisting Press Mentions:\n${JSON.stringify(context.existingPressData, null, 2)}\n\nIMPORTANT: Extract achievements from ALL available data above. Look for sales records, awards, certifications, specializations, and experience milestones in the bio and profile data.`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'synthesize_profile',
              description: 'Extract structured profile data',
              parameters: {
                type: 'object',
                properties: {
                  synthesized_bio: {
                    type: 'string',
                    description: 'Concise bio in third-person, 2-3 sentences max'
                  },
                  notable_achievements: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string' },
                        description: { type: 'string' },
                        year: { type: 'number' },
                        credibility: { type: 'number', description: 'Score 1-10' },
                        source: { type: 'string' },
                        source_url: { type: 'string', description: 'URL of the source if available' }
                      },
                      required: ['title', 'description', 'credibility']
                    }
                  },
                  publications: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string' },
                        type: { type: 'string', description: 'book, article, etc.' },
                        publisher: { type: 'string' },
                        year: { type: 'number' },
                        url: { type: 'string' }
                      },
                      required: ['title', 'type']
                    }
                  },
                  community_roles: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        organization: { type: 'string' },
                        role: { type: 'string' },
                        description: { type: 'string' }
                      },
                      required: ['organization', 'role']
                    }
                  }
                },
                required: ['synthesized_bio', 'notable_achievements'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'synthesize_profile' } }
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response:', JSON.stringify(aiData, null, 2));

    // Extract tool call result
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No tool call in AI response');
    }

    const synthesizedData = JSON.parse(toolCall.function.arguments);
    console.log('Synthesized data:', synthesizedData);

    // Sort achievements by credibility
    if (synthesizedData.notable_achievements) {
      synthesizedData.notable_achievements.sort((a: any, b: any) => 
        (b.credibility || 0) - (a.credibility || 0)
      );
      // Keep top 5
      synthesizedData.notable_achievements = synthesizedData.notable_achievements.slice(0, 5);
    }

    // Update professional record
    const { error: updateError } = await supabase
      .from('professionals')
      .update({
        synthesized_bio: synthesizedData.synthesized_bio,
        notable_achievements: synthesizedData.notable_achievements || [],
        publications: synthesizedData.publications || [],
        community_roles: synthesizedData.community_roles || [],
        profile_last_synthesized_at: new Date().toISOString()
      })
      .eq('id', professionalId);

    if (updateError) throw updateError;

    console.log('✅ Profile synthesis complete for:', professional.name);

    return new Response(
      JSON.stringify({
        success: true,
        data: synthesizedData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in synthesize-agent-profile:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        error: errorMessage
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});