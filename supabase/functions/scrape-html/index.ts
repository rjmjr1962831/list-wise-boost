import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as cheerio from "https://esm.sh/cheerio@1.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapeRequest {
  url: string;
  selectors?: {
    [key: string]: string; // CSS selectors to extract specific data
  };
  extractLinks?: boolean;
  extractImages?: boolean;
  extractText?: boolean;
}

interface ParsedData {
  [key: string]: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, selectors, extractLinks, extractImages, extractText }: ScrapeRequest = await req.json();
    
    console.log(`Scraping URL: ${url}`);

    // Fetch the HTML content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    console.log(`Successfully scraped ${html.length} characters`);

    // Parse HTML with Cheerio
    const $ = cheerio.load(html);
    const parsedData: ParsedData = {};

    // Extract data using custom selectors
    if (selectors) {
      for (const [key, selector] of Object.entries(selectors)) {
        const elements = $(selector);
        
        if (elements.length === 1) {
          // Single element - return as object
          parsedData[key] = {
            text: elements.text().trim(),
            html: elements.html(),
            attributes: elements.attr(),
          };
        } else if (elements.length > 1) {
          // Multiple elements - return as array
          parsedData[key] = elements.map((i, el) => ({
            text: $(el).text().trim(),
            html: $(el).html(),
            attributes: $(el).attr(),
          })).get();
        } else {
          parsedData[key] = null;
        }
      }
    }

    // Extract all links if requested
    if (extractLinks) {
      parsedData.links = $('a').map((i, el) => ({
        href: $(el).attr('href'),
        text: $(el).text().trim(),
      })).get();
    }

    // Extract all images if requested
    if (extractImages) {
      parsedData.images = $('img').map((i, el) => ({
        src: $(el).attr('src'),
        alt: $(el).attr('alt'),
      })).get();
    }

    // Extract main text content if requested
    if (extractText) {
      parsedData.bodyText = $('body').text().trim();
      parsedData.title = $('title').text().trim();
      parsedData.metaDescription = $('meta[name="description"]').attr('content');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        url,
        parsedData,
        rawHtml: html,
        contentLength: html.length 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in scrape-html:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
