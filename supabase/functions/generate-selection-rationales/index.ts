import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateRequest {
  cityId?: string;
  professionalIds?: string[];
  regenerateExisting?: boolean;
  batchSize?: number;
  offset?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cityId, professionalIds, regenerateExisting = false, batchSize = 15, offset = 0 }: GenerateRequest = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // First get total count
    let countQuery = supabase
      .from('professionals')
      .select('id', { count: 'exact', head: true })
      .eq('active', true)
      .gte('review_stars_rating', 4.8)
      .gte('num_total_reviews', 50);

    if (cityId) {
      countQuery = countQuery.eq('city_id', cityId);
    }
    if (professionalIds && professionalIds.length > 0) {
      countQuery = countQuery.in('id', professionalIds);
    }
    if (!regenerateExisting) {
      countQuery = countQuery.is('selection_rationale', null);
    }

    const { count: totalCount } = await countQuery;

    // Build query for qualified agents with pagination
    let query = supabase
      .from('professionals')
      .select(`
        id,
        name,
        company,
        review_stars_rating,
        num_total_reviews,
        years_experience,
        total_sales,
        specialty,
        notable_achievements,
        press_mentions,
        is_premier_agent,
        is_brand_builder,
        is_top_agent,
        selection_rationale,
        city_id,
        cities!inner(name, state)
      `)
      .eq('active', true)
      .gte('review_stars_rating', 4.8)
      .gte('num_total_reviews', 50)
      .order('name')
      .range(offset, offset + batchSize - 1);

    if (cityId) {
      query = query.eq('city_id', cityId);
    }

    if (professionalIds && professionalIds.length > 0) {
      query = query.in('id', professionalIds);
    }

    if (!regenerateExisting) {
      query = query.is('selection_rationale', null);
    }

    const { data: professionals, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching professionals:', fetchError);
      throw fetchError;
    }

    console.log(`Batch ${offset}-${offset + batchSize}: Found ${professionals?.length || 0} professionals (total: ${totalCount})`);

    if (!professionals || professionals.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          processed: 0, 
          message: 'No professionals to process',
          hasMore: false,
          totalCount: totalCount || 0,
          nextOffset: offset
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: Array<{ id: string; name: string; success: boolean; rationale?: string; error?: string }> = [];

    for (const professional of professionals) {
      try {
        console.log(`Generating rationale for: ${professional.name}`);

        // Build context for AI
        const cityInfo = professional.cities as { name: string; state: string };
        const specialties = (professional.specialty || []).join(', ');
        const achievements = (professional.notable_achievements || [])
          .slice(0, 3)
          .map((a: any) => a.title || a)
          .join(', ');
        const pressMentions = (professional.press_mentions || [])
          .slice(0, 2)
          .map((p: any) => p.source || p.title || p)
          .join(', ');

        const badges: string[] = [];
        if (professional.is_premier_agent) badges.push('Premier Agent');
        if (professional.is_brand_builder) badges.push('Verified Brand Builder');
        if (professional.is_top_agent) badges.push('Top Agent');

        const prompt = `Write a 2-3 sentence selection rationale explaining why ${professional.name} was selected for the Top 10 Real Estate Agents list in ${cityInfo.name}, ${cityInfo.state}.

Use this data (only include facts that are present):
- Rating: ${professional.review_stars_rating || 'N/A'} stars
- Reviews: ${professional.num_total_reviews || 0} verified reviews
- Experience: ${professional.years_experience || 'N/A'} years
- Total Sales: ${professional.total_sales ? `$${(professional.total_sales / 1000000).toFixed(1)}M+` : 'N/A'}
- Brokerage: ${professional.company || 'N/A'}
- Specialties: ${specialties || 'General residential'}
- Achievements: ${achievements || 'None listed'}
- Press: ${pressMentions || 'None listed'}
- Badges: ${badges.join(', ') || 'None'}

Write in third person, professional tone. Focus on their standout metrics and qualifications. Do not fabricate any data not provided above. If a metric says "N/A", do not mention it.`;

        // Call ai-router via internal supabase function call
        const aiResponse = await supabase.functions.invoke('ai-router', {
          body: {
            task: 'bio-generation',
            messages: [{ role: 'user', content: prompt }],
            systemPrompt: 'You are a professional copywriter creating concise selection rationales for a curated real estate agent directory. Write factual, compelling explanations in 2-3 sentences.',
            temperature: 0.7,
            maxTokens: 200
          }
        });

        if (aiResponse.error) {
          throw new Error(aiResponse.error.message || 'AI Router error');
        }

        const rationale = aiResponse.data?.choices?.[0]?.message?.content?.trim();

        if (!rationale) {
          throw new Error('No rationale generated');
        }

        // Save to database
        const { error: updateError } = await supabase
          .from('professionals')
          .update({
            selection_rationale: rationale,
            selection_rationale_generated_at: new Date().toISOString()
          })
          .eq('id', professional.id);

        if (updateError) {
          throw updateError;
        }

        results.push({
          id: professional.id,
          name: professional.name,
          success: true,
          rationale
        });

        console.log(`✅ Generated rationale for ${professional.name}`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Error for ${professional.name}:`, errorMsg);
        results.push({
          id: professional.id,
          name: professional.name,
          success: false,
          error: errorMsg
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const nextOffset = offset + professionals.length;
    const hasMore = nextOffset < (totalCount || 0);

    console.log(`Batch complete: ${successful} successful, ${failed} failed. hasMore: ${hasMore}, nextOffset: ${nextOffset}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        successful,
        failed,
        results,
        hasMore,
        nextOffset,
        totalCount: totalCount || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-selection-rationales:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
