import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cityId, categoryId, maxResults = 50 } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const outscraperApiKey = Deno.env.get('OUTSCRAPER_API_KEY');
    if (!outscraperApiKey) {
      throw new Error('OUTSCRAPER_API_KEY not configured');
    }

    // Get city and category details
    const { data: city } = await supabase
      .from('cities')
      .select('name, state')
      .eq('id', cityId)
      .single();

    const { data: category } = await supabase
      .from('categories')
      .select('name')
      .eq('id', categoryId)
      .single();

    if (!city || !category) {
      throw new Error('City or category not found');
    }

    console.log(`Starting Outscraper scrape for ${city.name}, ${city.state} - ${category.name}`);

    // Outscraper Google Maps Scraper API
    const query = `real estate agents in ${city.name}, ${city.state}`;
    const outscraperUrl = `https://api.app.outscraper.com/maps/search-v3?query=${encodeURIComponent(query)}&limit=${maxResults}&language=en&region=us&enrichments=emails_and_contacts,reviews_50`;

    console.log('Calling Outscraper API:', outscraperUrl);

    const response = await fetch(outscraperUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': outscraperApiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Outscraper API error:', errorText);
      throw new Error(`Outscraper API failed: ${response.status}`);
    }

    const data = await response.json();
    const agents = data.data?.[0] || [];
    
    console.log(`Outscraper returned ${agents.length} agents`);

    // Get next available rank
    const { data: maxRankData } = await supabase
      .from('professionals')
      .select('rank')
      .eq('city_id', cityId)
      .eq('category_id', categoryId)
      .order('rank', { ascending: false })
      .limit(1);

    let nextRank = maxRankData && maxRankData.length > 0 ? maxRankData[0].rank + 1 : 1;

    const imported: any[] = [];
    const skipped: any[] = [];

    for (const agent of agents) {
      try {
        const rating = agent.rating || 0;
        const reviewCount = agent.reviews || 0;
        
        // Filter by rating (4.9+) and reviews (minimum 10)
        if (rating < 4.9 || reviewCount < 10) {
          skipped.push({
            name: agent.name,
            reason: `Rating ${rating} or reviews ${reviewCount} below threshold`,
          });
          continue;
        }

        // Check if agent already exists by name + address
        const { data: existing } = await supabase
          .from('professionals')
          .select('id, rank')
          .eq('name', agent.name)
          .eq('city_id', cityId)
          .eq('category_id', categoryId)
          .maybeSingle();

        // Extract contact info from Outscraper response
        const phone = agent.phone || agent.phone_mobile || null;
        const email = agent.emails?.[0] || agent.email || null;
        const website = agent.site || agent.website || null;

        // Map Outscraper data to our schema
        const professionalData: any = {
          name: agent.name,
          company: agent.name, // Outscraper uses same field for business name
          phone: phone,
          email: email,
          website: website,
          
          // Address
          address: agent.full_address || agent.street || null,
          zip_code: agent.postal_code || agent.zip || null,
          
          // Stats
          review_stars_rating: rating,
          num_total_reviews: reviewCount,
          
          // JSON data - store full Outscraper response
          professional_information: [agent],
          ratings: {
            average: rating,
            count: reviewCount
          },
          
          // Images
          image_url: agent.photo_url || agent.photos?.[0] || null,
          
          // Reviews
          reviews_data: agent.reviews_data || null,
          
          // Timestamps
          updated_at: new Date().toISOString(),
        };

        if (existing) {
          // Update existing agent
          const { error: updateError } = await supabase
            .from('professionals')
            .update(professionalData)
            .eq('id', existing.id);

          if (updateError) {
            console.error(`Failed to update agent ${agent.name}:`, updateError);
            skipped.push({ name: agent.name, reason: updateError.message });
          } else {
            console.log(`Updated existing agent: ${agent.name}`);
            imported.push({
              id: existing.id,
              name: agent.name,
              updated: true,
            });
          }
        } else {
          // Insert new agent
          professionalData.city_id = cityId;
          professionalData.category_id = categoryId;
          professionalData.rank = nextRank;
          professionalData.type = 'individual';
          professionalData.active = true;
          professionalData.created_at = new Date().toISOString();

          const { data: inserted, error: insertError } = await supabase
            .from('professionals')
            .insert(professionalData)
            .select('id')
            .single();

          if (insertError) {
            console.error(`Failed to insert agent ${agent.name}:`, insertError);
            skipped.push({ name: agent.name, reason: insertError.message });
          } else {
            console.log(`Inserted new agent: ${agent.name} at rank ${nextRank}`);
            imported.push({
              id: inserted.id,
              name: agent.name,
              updated: false,
            });
            nextRank++;
          }
        }
      } catch (error) {
        console.error(`Error processing agent ${agent.name}:`, error);
        skipped.push({ name: agent.name, reason: error instanceof Error ? error.message : String(error) });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported: imported.length,
        skipped: skipped.length,
        agents: imported,
        skippedAgents: skipped,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fetch-outscraper-agents:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error) 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
