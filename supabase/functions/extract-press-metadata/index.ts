import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Extracting metadata from: ${url}`);

    // Fetch the page HTML
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Top10Lists/1.0; +https://top10lists.us)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      console.log(`Failed to fetch URL: ${response.status}`);
      return new Response(
        JSON.stringify({ 
          title: null, 
          outlet: extractDomainName(url),
          date: null,
          error: 'Could not fetch page' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = await response.text();
    
    // Extract metadata
    const title = extractTitle(html);
    const outlet = extractOutlet(html, url);
    const date = extractDate(html);

    console.log(`Extracted - Title: ${title}, Outlet: ${outlet}, Date: ${date}`);

    return new Response(
      JSON.stringify({ title, outlet, date }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error extracting metadata:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extractTitle(html: string): string | null {
  // Try og:title first
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  if (ogTitleMatch) return decodeHtmlEntities(ogTitleMatch[1]);
  
  // Try twitter:title
  const twitterTitleMatch = html.match(/<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i);
  if (twitterTitleMatch) return decodeHtmlEntities(twitterTitleMatch[1]);
  
  // Try <title> tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    let title = decodeHtmlEntities(titleMatch[1]);
    // Remove common suffixes like " | Site Name" or " - Site Name"
    title = title.replace(/\s*[\|\-–—]\s*[^|\-–—]+$/, '').trim();
    return title;
  }
  
  // Try h1
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) return decodeHtmlEntities(h1Match[1]);
  
  return null;
}

function extractOutlet(html: string, url: string): string {
  // Try og:site_name
  const ogSiteMatch = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i);
  if (ogSiteMatch) return decodeHtmlEntities(ogSiteMatch[1]);
  
  // Try application-name
  const appNameMatch = html.match(/<meta[^>]*name=["']application-name["'][^>]*content=["']([^"']+)["']/i);
  if (appNameMatch) return decodeHtmlEntities(appNameMatch[1]);
  
  // Try publisher
  const publisherMatch = html.match(/<meta[^>]*name=["']publisher["'][^>]*content=["']([^"']+)["']/i);
  if (publisherMatch) return decodeHtmlEntities(publisherMatch[1]);
  
  // Fall back to domain name
  return extractDomainName(url);
}

function extractDate(html: string): string | null {
  // Try article:published_time
  const articleDateMatch = html.match(/<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i);
  if (articleDateMatch) {
    const parsed = parseDate(articleDateMatch[1]);
    if (parsed) return parsed;
  }
  
  // Try datePublished (schema.org)
  const schemaDateMatch = html.match(/"datePublished"\s*:\s*"([^"]+)"/i);
  if (schemaDateMatch) {
    const parsed = parseDate(schemaDateMatch[1]);
    if (parsed) return parsed;
  }
  
  // Try published_time
  const pubTimeMatch = html.match(/<meta[^>]*property=["']published_time["'][^>]*content=["']([^"']+)["']/i);
  if (pubTimeMatch) {
    const parsed = parseDate(pubTimeMatch[1]);
    if (parsed) return parsed;
  }
  
  // Try time element with datetime
  const timeMatch = html.match(/<time[^>]*datetime=["']([^"']+)["']/i);
  if (timeMatch) {
    const parsed = parseDate(timeMatch[1]);
    if (parsed) return parsed;
  }
  
  // Try DC.date
  const dcDateMatch = html.match(/<meta[^>]*name=["']DC\.date["'][^>]*content=["']([^"']+)["']/i);
  if (dcDateMatch) {
    const parsed = parseDate(dcDateMatch[1]);
    if (parsed) return parsed;
  }
  
  return null;
}

function parseDate(dateStr: string): string | null {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0]; // Return YYYY-MM-DD
  } catch {
    return null;
  }
}

function extractDomainName(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // Remove www. and format nicely
    let domain = hostname.replace(/^www\./, '');
    // Capitalize first letter of each part
    const parts = domain.split('.');
    if (parts.length >= 2) {
      // Return the main domain name, capitalized
      const mainPart = parts[parts.length - 2];
      return mainPart.charAt(0).toUpperCase() + mainPart.slice(1);
    }
    return domain;
  } catch {
    return 'Unknown';
  }
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ')
    .trim();
}
