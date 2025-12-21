import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CanonicalRanking {
  city_id: string;
  category_id: string;
  professional_id: string;
  rank: number;
  score: number;
}

/**
 * Calculates a deterministic score for an agent
 */
function calculateAgentScore(professional: any): number {
  let score = 0;
  
  // Rating (0-50 points) - Most important factor
  const rating = professional.review_stars_rating || 0;
  score += (rating / 5) * 50;
  
  // Review count (0-20 points)
  const reviews = professional.num_total_reviews || 0;
  score += Math.min(reviews / 10, 20);
  
  // Total sales (0-15 points)
  const sales = professional.total_sales || 0;
  score += Math.min(sales / 100, 15);
  
  // Years experience (0-10 points)
  const years = professional.years_experience || 0;
  score += Math.min(years / 2, 10);
  
  // Recent review activity (0-5 points)
  if (professional.has_recent_review) {
    score += 5;
  }
  
  // Press mentions (0-5 points)
  const pressMentions = professional.press_mentions?.length || 0;
  score += Math.min(pressMentions, 5);
  
  // Special badges (0-5 points)
  if (professional.is_brand_builder) score += 2;
  if (professional.is_premier_agent) score += 2;
  if (professional.is_top_agent) score += 1;
  
  return Math.round(score * 100) / 100;
}

/**
 * Regenerates canonical rankings for a specific city/category
 */
async function regenerateCanonicalRankings(
  supabase: any,
  cityId: string,
  categoryId: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    console.log(`Regenerating canonical rankings for city: ${cityId}, category: ${categoryId}`);
    
    // Fetch all active professionals for this city/category
    const { data: professionals, error: fetchError } = await supabase
      .from('professionals')
      .select('*')
      .eq('city_id', cityId)
      .eq('category_id', categoryId)
      .eq('active', true)
      .gte('review_stars_rating', 4.5);

    if (fetchError) {
      console.error('Error fetching professionals:', fetchError);
      return { success: false, count: 0, error: fetchError.message };
    }

    if (!professionals || professionals.length === 0) {
      console.log('No professionals found for this city/category');
      return { success: true, count: 0 };
    }

    // Calculate scores for each professional
    const scoredProfessionals = professionals.map((prof: any) => ({
      ...prof,
      calculatedScore: calculateAgentScore(prof)
    }));

    // Sort by score (descending) and then by name (ascending) for determinism
    scoredProfessionals.sort((a: any, b: any) => {
      if (b.calculatedScore !== a.calculatedScore) {
        return b.calculatedScore - a.calculatedScore;
      }
      return a.name.localeCompare(b.name);
    });

    // Take top 10
    const topProfessionals = scoredProfessionals.slice(0, 10);

    // Delete existing canonical rankings for this city/category
    const { error: deleteError } = await supabase
      .from('canonical_city_rankings')
      .delete()
      .eq('city_id', cityId)
      .eq('category_id', categoryId);

    if (deleteError) {
      console.error('Error deleting old rankings:', deleteError);
      return { success: false, count: 0, error: deleteError.message };
    }

    // Insert new canonical rankings
    const rankingsToInsert: CanonicalRanking[] = topProfessionals.map((prof: any, index: number) => ({
      city_id: cityId,
      category_id: categoryId,
      professional_id: prof.id,
      rank: index + 1,
      score: prof.calculatedScore
    }));

    const { error: insertError } = await supabase
      .from('canonical_city_rankings')
      .insert(rankingsToInsert);

    if (insertError) {
      console.error('Error inserting new rankings:', insertError);
      return { success: false, count: 0, error: insertError.message };
    }

    console.log(`✅ Successfully regenerated ${rankingsToInsert.length} canonical rankings`);
    return { success: true, count: rankingsToInsert.length };
    
  } catch (error) {
    console.error('Error in regenerateCanonicalRankings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, count: 0, error: errorMessage };
  }
}

/**
 * Invalidates Prerender.io cache for a specific URL
 */
async function invalidatePrerenderCache(url: string): Promise<boolean> {
  const prerenderToken = Deno.env.get('PRERENDER_TOKEN');
  
  if (!prerenderToken) {
    console.warn('PRERENDER_TOKEN not configured, skipping cache invalidation');
    return true; // Don't fail the job if prerender isn't configured
  }

  try {
    console.log(`Invalidating Prerender.io cache for: ${url}`);
    
    const response = await fetch('https://api.prerender.io/recache', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Prerender-Token': prerenderToken
      },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      console.error(`Prerender cache invalidation failed: ${response.status}`);
      return false;
    }

    console.log('✅ Successfully invalidated Prerender cache');
    return true;
  } catch (error) {
    console.error('Error invalidating Prerender cache:', error);
    return false;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Starting cache invalidation processor...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const appUrl = Deno.env.get('APP_URL') || 'https://top10lists.us';
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch pending cache invalidation items
    const { data: queueItems, error: fetchError } = await supabase
      .from('cache_invalidation_queue')
      .select(`
        *,
        cities (slug, state_slug),
        categories (slug)
      `)
      .eq('status', 'pending')
      .lt('attempts', 3)
      .order('created_at', { ascending: true })
      .limit(10); // Process 10 at a time

    if (fetchError) {
      console.error('Error fetching queue items:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch queue items', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('No pending cache invalidation items');
      return new Response(
        JSON.stringify({ message: 'No items to process', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${queueItems.length} cache invalidation items`);

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      details: [] as any[]
    };

    // Process each queue item
    for (const item of queueItems) {
      console.log(`Processing invalidation for city: ${item.cities?.slug}, category: ${item.categories?.slug}`);
      
      // Mark as processing
      await supabase
        .from('cache_invalidation_queue')
        .update({ 
          status: 'processing',
          attempts: item.attempts + 1
        })
        .eq('id', item.id);

      try {
        // Regenerate canonical rankings
        const result = await regenerateCanonicalRankings(
          supabase,
          item.city_id,
          item.category_id
        );

        if (!result.success) {
          throw new Error(result.error || 'Failed to regenerate rankings');
        }

        // Build URL for cache invalidation
        const url = `${appUrl}/${item.cities?.state_slug}/${item.cities?.slug}/${item.categories?.slug}`;
        
        // Invalidate Prerender cache (non-blocking failure)
        await invalidatePrerenderCache(url);

        // Mark as completed
        await supabase
          .from('cache_invalidation_queue')
          .update({ 
            status: 'completed',
            processed_at: new Date().toISOString(),
            error_message: null
          })
          .eq('id', item.id);

        results.succeeded++;
        results.details.push({
          id: item.id,
          city: item.cities?.slug,
          category: item.categories?.slug,
          status: 'success',
          rankingsCount: result.count
        });

        console.log(`✅ Successfully processed invalidation for ${item.cities?.slug}`);
        
      } catch (error) {
        console.error(`Error processing item ${item.id}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Mark as failed if max attempts reached, otherwise leave as pending
        const status = item.attempts + 1 >= 3 ? 'failed' : 'pending';
        
        await supabase
          .from('cache_invalidation_queue')
          .update({ 
            status,
            error_message: errorMessage,
            processed_at: status === 'failed' ? new Date().toISOString() : null
          })
          .eq('id', item.id);

        results.failed++;
        results.details.push({
          id: item.id,
          city: item.cities?.slug,
          category: item.categories?.slug,
          status: 'failed',
          error: errorMessage
        });
      }

      results.processed++;
    }

    console.log(`✅ Cache invalidation complete: ${results.succeeded} succeeded, ${results.failed} failed`);

    return new Response(
      JSON.stringify({
        message: 'Cache invalidation processing complete',
        ...results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-cache-invalidation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
