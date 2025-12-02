import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PRERENDER_TOKEN = Deno.env.get('PRERENDER_TOKEN');
const PRERENDER_API = 'https://api.prerender.io/recache';
const BATCH_SIZE = 1000;

interface RecacheRequest {
  sitemapUrl?: string;
  urls?: string[];
  adaptiveType?: 'desktop' | 'mobile';
}

async function fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
  console.log(`Fetching sitemap: ${sitemapUrl}`);
  
  const response = await fetch(sitemapUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap: ${response.status}`);
  }
  
  const xml = await response.text();
  
  // Parse URLs from sitemap XML using regex (simple approach for edge function)
  const urlMatches = xml.match(/<loc>([^<]+)<\/loc>/g) || [];
  const urls = urlMatches.map(match => {
    const url = match.replace(/<\/?loc>/g, '').trim();
    return url;
  });
  
  console.log(`Found ${urls.length} URLs in sitemap`);
  return urls;
}

async function sendRecacheBatch(
  urls: string[], 
  batchNumber: number, 
  adaptiveType: string
): Promise<{ success: boolean; message: string; count: number }> {
  console.log(`Sending batch ${batchNumber} with ${urls.length} URLs`);
  
  const payload = {
    prerenderToken: PRERENDER_TOKEN,
    urls: urls,
    adaptiveType: adaptiveType
  };
  
  const response = await fetch(PRERENDER_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  const responseText = await response.text();
  
  if (response.ok) {
    console.log(`Batch ${batchNumber}: Success - ${responseText}`);
    return { success: true, message: responseText, count: urls.length };
  } else {
    console.error(`Batch ${batchNumber}: Failed - ${response.status} ${responseText}`);
    return { success: false, message: `${response.status}: ${responseText}`, count: 0 };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!PRERENDER_TOKEN) {
      throw new Error('PRERENDER_TOKEN not configured');
    }

    const { sitemapUrl, urls: inputUrls, adaptiveType = 'desktop' }: RecacheRequest = await req.json();
    
    let urls: string[] = [];
    
    // Fetch URLs from sitemap if provided
    if (sitemapUrl) {
      const sitemapUrls = await fetchSitemapUrls(sitemapUrl);
      urls.push(...sitemapUrls);
    }
    
    // Add any directly provided URLs
    if (inputUrls && Array.isArray(inputUrls)) {
      urls.push(...inputUrls);
    }
    
    if (urls.length === 0) {
      throw new Error('No URLs provided. Please provide a sitemapUrl or urls array.');
    }
    
    // Remove duplicates
    urls = [...new Set(urls)];
    console.log(`Processing ${urls.length} unique URLs with adaptiveType: ${adaptiveType}`);
    
    // Split into batches of 1000
    const batches: string[][] = [];
    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      batches.push(urls.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`Split into ${batches.length} batches`);
    
    // Process batches
    const results: { batch: number; success: boolean; message: string; count: number }[] = [];
    
    for (let i = 0; i < batches.length; i++) {
      const result = await sendRecacheBatch(batches[i], i + 1, adaptiveType);
      results.push({ batch: i + 1, ...result });
      
      // Small delay between batches to avoid rate limiting
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    const successCount = results.filter(r => r.success).reduce((sum, r) => sum + r.count, 0);
    const failedBatches = results.filter(r => !r.success).length;
    
    console.log(`Recache complete: ${successCount} URLs processed, ${failedBatches} batches failed`);
    
    return new Response(JSON.stringify({
      success: failedBatches === 0,
      totalUrls: urls.length,
      processedUrls: successCount,
      totalBatches: batches.length,
      failedBatches: failedBatches,
      results: results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in recache-prerender:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
