/**
 * rescrape-missing-photos
 * 
 * Re-scrapes agents with invalid/missing profile photos using Firecrawl
 * Also moves YouTube URLs from image_url to sidebar_video_url
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v2/scrape';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Invalid patterns that indicate the image_url is not a real profile photo
const INVALID_IMAGE_PATTERNS = [
  'youtube.com',
  '/images/default-profile',
  'nophoto_p_b.png',
  '/profile/photo/imageURL',
  'agent-finder-showcase-banner',
  'digitallibrary.zillowgroup.com',
  'example.com',
  '/path/to/',
  'placeholder',
];

// Valid Zillow photo patterns
const VALID_PHOTO_PATTERNS = [
  'photos.zillowstatic.com',
  'streeteasy',
  'digitalassets.zillowgroup.com',
];

function isInvalidImageUrl(url: string | null): boolean {
  if (!url) return true;
  const lower = url.toLowerCase();
  return INVALID_IMAGE_PATTERNS.some(p => lower.includes(p)) ||
    !VALID_PHOTO_PATTERNS.some(p => lower.includes(p));
}

function isYouTubeUrl(url: string | null): boolean {
  if (!url) return false;
  return url.toLowerCase().includes('youtube.com');
}

/**
 * Extract profile photo URL from HTML
 */
function extractProfilePhotoFromHtml(html: string): string | null {
  if (!html) return null;
  
  // Pattern 1: Zillow CDN profile photos
  const zillowCdnMatch = html.match(/src=["'](https:\/\/photos\.zillowstatic\.com\/fp\/[^"']+)["']/i);
  if (zillowCdnMatch) return zillowCdnMatch[1];
  
  // Pattern 2: StreetEasy CDN photos
  const streetEasyMatch = html.match(/src=["'](https:\/\/[^"']*streeteasy[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i);
  if (streetEasyMatch) return streetEasyMatch[1];
  
  // Pattern 3: Zillow delivery CDN (not banners)
  const deliveryCdnMatch = html.match(/src=["'](https:\/\/delivery\.digitalassets\.zillowgroup\.com\/[^"']+)["']/i);
  if (deliveryCdnMatch) {
    const url = deliveryCdnMatch[1];
    if (!url.includes('PremierAgent_downloadOriginal.svg') && !url.includes('agent-finder-showcase-banner')) {
      return url;
    }
  }
  
  return null;
}

async function scrapeAgentPhoto(zillowUrl: string): Promise<string | null> {
  if (!FIRECRAWL_API_KEY) {
    throw new Error('FIRECRAWL_API_KEY not configured');
  }

  console.log(`[Rescrape] Fetching photo from: ${zillowUrl}`);
  
  const response = await fetch(FIRECRAWL_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: zillowUrl,
      formats: ['html'],
      onlyMainContent: false,
      waitFor: 2000
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Rescrape] Firecrawl error: ${errorText}`);
    return null;
  }

  const result = await response.json();
  if (!result.success || !result.data?.html) {
    console.log(`[Rescrape] No HTML returned`);
    return null;
  }

  return extractProfilePhotoFromHtml(result.data.html);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { state = 'Arizona', limit = 10, dryRun = false } = await req.json().catch(() => ({}));
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find agents with invalid image_url in the specified state
    const { data: agents, error: fetchError } = await supabase
      .from('professionals')
      .select(`
        id,
        name,
        image_url,
        sidebar_video_url,
        zillow_profile_url,
        cities!inner(state)
      `)
      .eq('active', true)
      .eq('cities.state', state)
      .not('zillow_profile_url', 'is', null)
      .limit(500);

    if (fetchError) {
      throw new Error(`Failed to fetch agents: ${fetchError.message}`);
    }

    // Filter to those with invalid photos
    const agentsToProcess = agents?.filter(a => isInvalidImageUrl(a.image_url)) || [];
    const toProcess = agentsToProcess.slice(0, limit);

    console.log(`[Rescrape] Found ${agentsToProcess.length} agents with invalid photos in ${state}, processing ${toProcess.length}`);

    if (dryRun) {
      return new Response(JSON.stringify({
        success: true,
        dryRun: true,
        totalInvalid: agentsToProcess.length,
        wouldProcess: toProcess.length,
        agents: toProcess.map(a => ({
          name: a.name,
          currentImage: a.image_url,
          isYouTube: isYouTubeUrl(a.image_url),
          zillowUrl: a.zillow_profile_url
        }))
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results = {
      processed: 0,
      photoFound: 0,
      youtubeMovedToVideo: 0,
      noPhotoFound: 0,
      errors: 0,
      details: [] as any[]
    };

    for (const agent of toProcess) {
      try {
        const updates: Record<string, any> = {};
        
        // If current image_url is a YouTube URL, move it to sidebar_video_url
        if (isYouTubeUrl(agent.image_url)) {
          if (!agent.sidebar_video_url) {
            updates.sidebar_video_url = agent.image_url;
            results.youtubeMovedToVideo++;
          }
        }

        // Scrape for actual photo
        const newPhotoUrl = await scrapeAgentPhoto(agent.zillow_profile_url);
        
        if (newPhotoUrl) {
          updates.image_url = newPhotoUrl;
          results.photoFound++;
          console.log(`[Rescrape] ✓ ${agent.name}: Found photo`);
        } else {
          // Clear invalid URL, set to null
          updates.image_url = null;
          results.noPhotoFound++;
          console.log(`[Rescrape] ✗ ${agent.name}: No photo found`);
        }

        // Update agent
        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from('professionals')
            .update(updates)
            .eq('id', agent.id);

          if (updateError) {
            console.error(`[Rescrape] Update failed for ${agent.name}: ${updateError.message}`);
            results.errors++;
          }
        }

        results.processed++;
        results.details.push({
          name: agent.name,
          oldImage: agent.image_url,
          newImage: newPhotoUrl,
          youtubeMovedToVideo: isYouTubeUrl(agent.image_url)
        });

        // Small delay between requests
        await new Promise(r => setTimeout(r, 500));
        
      } catch (err) {
        console.error(`[Rescrape] Error processing ${agent.name}:`, err);
        results.errors++;
      }
    }

    console.log(`[Rescrape] Complete: ${results.photoFound} photos found, ${results.youtubeMovedToVideo} YouTube moved, ${results.noPhotoFound} no photo`);

    return new Response(JSON.stringify({
      success: true,
      state,
      totalInvalidInState: agentsToProcess.length,
      ...results
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[Rescrape] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
