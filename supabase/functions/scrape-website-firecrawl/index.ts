/**
 * scrape-website-firecrawl
 * 
 * Drop-in replacement for scrape-html
 * Returns clean markdown instead of raw HTML
 * Automatically strips nav, footer, listings, sidebars
 * 
 * NEW: Supports JSON extraction mode for structured Zillow data
 * 
 * Token savings: ~60-75% fewer tokens to Claude for synthesis
 */

const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

interface ScrapeResult {
  success: boolean;
  url: string;
  content: string;
  contentLength: number;
  estimatedTokens: number;
  title?: string;
  description?: string;
  error?: string;
}

interface JsonScrapeResult {
  success: boolean;
  url: string;
  data: Record<string, unknown>;
  error?: string;
}

// JSON extraction with schema
async function scrapeWithJsonExtraction(url: string, schema: Record<string, unknown>): Promise<JsonScrapeResult> {
  console.log(`[Firecrawl JSON] Scraping with schema: ${url}`);
  const startTime = Date.now();

  if (!FIRECRAWL_API_KEY) {
    return {
      success: false,
      url: url,
      data: {},
      error: 'FIRECRAWL_API_KEY is not configured'
    };
  }

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: url,
        formats: ['json'],
        jsonOptions: {
          schema: schema
        },
        waitFor: 3000,
        timeout: 60000
      })
    });

    const duration = Date.now() - startTime;
    console.log(`[Firecrawl JSON] Response in ${duration}ms`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Firecrawl JSON] HTTP error: ${response.status} - ${errorText}`);
      return {
        success: false,
        url: url,
        data: {},
        error: `HTTP ${response.status}: ${errorText}`
      };
    }

    const result = await response.json();
    console.log(`[Firecrawl JSON] Result:`, JSON.stringify(result, null, 2));

    if (!result.success) {
      return {
        success: false,
        url: url,
        data: {},
        error: result.error || 'Unknown Firecrawl error'
      };
    }

    // Extract JSON data from response
    const jsonData = result.data?.json || result.data?.extract || {};

    return {
      success: true,
      url: url,
      data: jsonData
    };

  } catch (error) {
    console.error(`[Firecrawl JSON] Error:`, error);
    return {
      success: false,
      url: url,
      data: {},
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function scrapeWebsite(url: string): Promise<ScrapeResult> {
  console.log(`[Firecrawl Website] Scraping: ${url}`);
  const startTime = Date.now();

  if (!FIRECRAWL_API_KEY) {
    return {
      success: false,
      url: url,
      content: '',
      contentLength: 0,
      estimatedTokens: 0,
      error: 'FIRECRAWL_API_KEY is not configured'
    };
  }

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: url,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 2000,
        timeout: 30000
      })
    });

    const duration = Date.now() - startTime;
    console.log(`[Firecrawl Website] Response in ${duration}ms`);

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        url: url,
        content: '',
        contentLength: 0,
        estimatedTokens: 0,
        error: `HTTP ${response.status}: ${errorText}`
      };
    }

    const result = await response.json();

    if (!result.success) {
      return {
        success: false,
        url: url,
        content: '',
        contentLength: 0,
        estimatedTokens: 0,
        error: result.error || 'Unknown Firecrawl error'
      };
    }

    const markdown = result.data?.markdown || '';
    const metadata = result.data?.metadata || {};

    // Clean up markdown further
    const cleanedContent = cleanMarkdown(markdown);

    return {
      success: true,
      url: url,
      content: cleanedContent,
      contentLength: cleanedContent.length,
      estimatedTokens: Math.ceil(cleanedContent.length / 4),
      title: metadata.title,
      description: metadata.description
    };

  } catch (error) {
    return {
      success: false,
      url: url,
      content: '',
      contentLength: 0,
      estimatedTokens: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

function cleanMarkdown(markdown: string): string {
  return markdown
    // Remove excessive newlines
    .replace(/\n{3,}/g, '\n\n')
    // Remove image markdown if not needed
    .replace(/!\[.*?\]\(.*?\)/g, '')
    // Remove empty links
    .replace(/\[]\(.*?\)/g, '')
    // Remove horizontal rules
    .replace(/---+/g, '')
    // Remove "Skip to" links
    .replace(/\[Skip.*?\]\(.*?\)/gi, '')
    // Remove "Loading" placeholders
    .replace(/Loading\.{0,3}/gi, '')
    // Trim whitespace
    .trim();
}

// Scrape multiple pages from the same domain (homepage + about)
async function scrapeAgentWebsiteWithAbout(baseUrl: string): Promise<{
  combined: ScrapeResult;
  pages: ScrapeResult[];
}> {
  // Normalize URL
  const url = new URL(baseUrl);
  const normalizedBase = `${url.protocol}//${url.host}`;

  // Pages to try
  const pagesToTry = [
    normalizedBase,
    `${normalizedBase}/about`,
    `${normalizedBase}/about-us`,
    `${normalizedBase}/about-me`,
    `${normalizedBase}/bio`,
    `${normalizedBase}/team`,
    `${normalizedBase}/our-team`,
    `${normalizedBase}/meet-the-team`
  ];

  const results: ScrapeResult[] = [];
  let combinedContent = '';

  // Scrape homepage first (always)
  const homepageResult = await scrapeWebsite(normalizedBase);
  results.push(homepageResult);
  
  if (homepageResult.success) {
    combinedContent += `## Homepage\n\n${homepageResult.content}\n\n`;
  }

  // Try about pages (stop after first success)
  const aboutPages = pagesToTry.slice(1);
  for (const aboutUrl of aboutPages) {
    try {
      const aboutResult = await scrapeWebsite(aboutUrl);
      results.push(aboutResult);
      
      if (aboutResult.success && aboutResult.content.length > 200) {
        combinedContent += `## About Page\n\n${aboutResult.content}\n\n`;
        break; // Found a good about page, stop trying others
      }
    } catch {
      // Skip failed pages silently
    }
    
    // Small delay between requests
    await new Promise(r => setTimeout(r, 500));
  }

  const combined: ScrapeResult = {
    success: combinedContent.length > 0,
    url: baseUrl,
    content: combinedContent.trim(),
    contentLength: combinedContent.length,
    estimatedTokens: Math.ceil(combinedContent.length / 4)
  };

  return { combined, pages: results };
}

// Zillow Agent Schema for JSON extraction
const ZILLOW_AGENT_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    profileUrl: { type: "string" },
    photoUrl: { type: "string" },
    zillowRating: { type: "number" },
    reviewCount: { type: "number" },
    totalSales: { type: "number" },
    salesLast12Months: { type: "number" },
    currentListings: { type: "number" },
    listingsForSale: { type: "number" },
    yearsExperience: { type: "number" },
    licenseNumber: { type: "string" },
    licenseState: { type: "string" },
    brokerageName: { type: "string" },
    brokerageAddress: { type: "string" },
    brokeragePhone: { type: "string" },
    phone: { type: "string" },
    email: { type: "string" },
    website: { type: "string" },
    serviceAreas: { type: "array", items: { type: "string" } },
    primaryCity: { type: "string" },
    primaryState: { type: "string" },
    specialties: { type: "array", items: { type: "string" } },
    avgListPrice: { type: "string" },
    avgSalePrice: { type: "string" },
    priceRange: { type: "string" }
  },
  required: ["name"]
};

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      url, 
      includeAboutPage = true,
      maxContentLength = 15000,
      useJsonExtraction = false,
      jsonSchema = null,
      extractZillowAgent = false
    } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'url is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // JSON extraction mode for Zillow agents
    if (useJsonExtraction || extractZillowAgent) {
      const schemaToUse = extractZillowAgent ? ZILLOW_AGENT_SCHEMA : jsonSchema;
      
      if (!schemaToUse) {
        return new Response(
          JSON.stringify({ success: false, error: 'jsonSchema required for JSON extraction mode' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const jsonResult = await scrapeWithJsonExtraction(url, schemaToUse);

      return new Response(
        JSON.stringify({
          success: jsonResult.success,
          data: jsonResult.data,
          url: jsonResult.url,
          error: jsonResult.error,
          meta: {
            scrapeMethod: 'firecrawl-json',
            creditsUsed: jsonResult.success ? 1 : 0
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Standard markdown extraction mode
    let result;

    if (includeAboutPage) {
      const { combined, pages } = await scrapeAgentWebsiteWithAbout(url);
      
      // Truncate if too long
      if (combined.content.length > maxContentLength) {
        combined.content = combined.content.substring(0, maxContentLength) + '\n\n[Content truncated]';
        combined.contentLength = combined.content.length;
        combined.estimatedTokens = Math.ceil(combined.content.length / 4);
      }

      result = {
        success: combined.success,
        data: combined,
        pages: pages.map(p => ({
          url: p.url,
          success: p.success,
          contentLength: p.contentLength,
          error: p.error
        })),
        meta: {
          scrapeMethod: 'firecrawl',
          pagesAttempted: pages.length,
          pagesSucceeded: pages.filter(p => p.success).length,
          creditsUsed: pages.filter(p => p.success).length
        }
      };
    } else {
      const singleResult = await scrapeWebsite(url);
      
      // Truncate if too long
      if (singleResult.content.length > maxContentLength) {
        singleResult.content = singleResult.content.substring(0, maxContentLength) + '\n\n[Content truncated]';
        singleResult.contentLength = singleResult.content.length;
        singleResult.estimatedTokens = Math.ceil(singleResult.content.length / 4);
      }

      result = {
        success: singleResult.success,
        data: singleResult,
        meta: {
          scrapeMethod: 'firecrawl',
          creditsUsed: singleResult.success ? 1 : 0
        }
      };
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Firecrawl Website] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
