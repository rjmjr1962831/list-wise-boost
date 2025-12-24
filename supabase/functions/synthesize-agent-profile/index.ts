import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// TOKEN OPTIMIZATION: Maximum characters for website content (reduced from 25K to 8K)
const MAX_WEBSITE_CONTENT_CHARS = 8000;

const SMTP_HOST = "mail.privateemail.com";
const SMTP_PORT = 465;

// Send failover alert email via SMTP
async function sendFailoverAlert(agentName: string, failedService: string, fallbackService: string, errorDetails: string) {
  const smtpUsername = Deno.env.get('SMTP_USERNAME');
  const smtpPassword = Deno.env.get('SMTP_PASSWORD');
  const adminEmail = Deno.env.get('ADMIN_EMAIL');
  const configuredFrom = Deno.env.get('SMTP_FROM_EMAIL');
  const fromEmail = (configuredFrom && configuredFrom.includes('@')) ? configuredFrom : (smtpUsername || 'alerts@top10lists.us');
  
  if (!smtpUsername || !smtpPassword || !adminEmail) {
    console.error('❌ Cannot send failover alert: SMTP credentials or ADMIN_EMAIL not configured');
    return;
  }

  try {
    const client = new SMTPClient({
      connection: {
        hostname: SMTP_HOST,
        port: SMTP_PORT,
        tls: true,
        auth: {
          username: smtpUsername,
          password: smtpPassword,
        },
      },
    });

    await client.send({
      from: fromEmail,
      to: adminEmail,
      subject: `🔄 FAILOVER: ${failedService} → ${fallbackService}`,
      html: `
        <h2>AI Service Failover Alert</h2>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        <p><strong>Failed Service:</strong> ${failedService}</p>
        <p><strong>Fallback Service:</strong> ${fallbackService}</p>
        <p><strong>Agent being processed:</strong> ${agentName}</p>
        <p><strong>Error:</strong> ${errorDetails}</p>
        <hr>
        <p>The enrichment pipeline has automatically switched to the fallback service. Consider:</p>
        <ul>
          <li>Checking ${failedService} API status and credits</li>
          <li>Reviewing error logs for patterns</li>
          <li>Verifying API key validity</li>
        </ul>
      `,
    });

    await client.close();
    console.log(`📧 Failover alert email sent: ${failedService} → ${fallbackService}`);
  } catch (error) {
    console.error('❌ Error sending failover alert:', error);
  }
}

// OpenAI GPT-4o tool calling schema (equivalent to Claude's)
const OPENAI_SYNTHESIS_TOOL = {
  type: "function" as const,
  function: {
    name: 'synthesize_profile',
    description: 'Create a 150-200 word professional biography in 4 paragraphs with markdown bold formatting for key categories',
    parameters: {
      type: 'object',
      properties: {
        synthesized_bio: {
          type: 'string',
          description: '150-200 word biography in 4 paragraphs. Bold numbers/stats, certifications, awards, press outlets, community roles, and charities. Do NOT bold names, brokerages, locations. Never include cities/neighborhoods/service areas.'
        },
        specialties_extracted: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of specialties extracted from website/bio (investors, luxury, first-time buyers, etc.)'
        },
        notable_achievements: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              date: { type: 'string', description: 'Year or date if available (YYYY format)' },
              credibility: { type: 'number', description: 'Score 1-10' },
              source: { type: 'string' },
              source_url: { type: 'string', description: 'URL of the source if available' }
            },
            required: ['title', 'description', 'credibility']
          },
          description: 'Include PERSONAL achievements (valedictorian, scholarships, degrees) and PROFESSIONAL achievements (awards, rankings)'
        },
        publications: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              type: { type: 'string', description: 'book, article, etc.' },
              publisher: { type: 'string' },
              date: { type: 'string', description: 'Year or date' },
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
              organization: { type: 'string', description: 'Name of charity, nonprofit, or community organization' },
              role: { type: 'string', description: 'Their role (supporter, board member, volunteer, founder, etc.)' },
              description: { type: 'string', description: 'What they do for this organization' }
            },
            required: ['organization', 'role']
          },
          description: 'Charities supported, nonprofits, volunteer work, community involvement'
        },
        awards_verified: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              award_name: { type: 'string', description: 'Name of the award' },
              year: { type: 'string', description: 'Year awarded (YYYY format)' },
              awarding_organization: { type: 'string', description: 'Organization that gave the award' },
              source_url: { type: 'string', description: 'URL of third-party source verifying the award' }
            },
            required: ['award_name']
          },
          description: 'Awards verified by third-party sources'
        },
        certifications_verified: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              designation: { type: 'string', description: 'Designation acronym (CRS, GRI, CCIM, etc.)' },
              full_name: { type: 'string', description: 'Full name of the certification' },
              verifying_organization: { type: 'string', description: 'Organization that issued/verified it' },
              source_url: { type: 'string', description: 'URL of verification source' }
            },
            required: ['designation', 'full_name']
          },
          description: 'Certifications/designations verified by third-party sources'
        }
      },
      required: ['synthesized_bio', 'notable_achievements', 'community_roles']
    }
  }
};

// Call OpenAI GPT-4o as fallback
async function callOpenAIFallback(systemPrompt: string, userPrompt: string, openaiApiKey: string): Promise<any> {
  console.log('🔄 [FAILOVER] Calling OpenAI GPT-4o...');
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 4096,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      tools: [OPENAI_SYNTHESIS_TOOL],
      tool_choice: { type: 'function', function: { name: 'synthesize_profile' } }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  // Extract tool call from OpenAI response format
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    throw new Error('No tool call in OpenAI response');
  }
  
  return JSON.parse(toolCall.function.arguments);
}

/**
 * Strip HTML tags and clean content for token optimization
 */
function stripHtmlAndClean(html: string): string {
  // Remove script and style tags with their content
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');
  
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  
  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&rsquo;/g, "'");
  text = text.replace(/&ldquo;/g, '"');
  text = text.replace(/&rdquo;/g, '"');
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

/**
 * Truncate content to reduce token usage (respects sentence boundaries)
 */
function truncateContent(content: string, maxChars: number = MAX_WEBSITE_CONTENT_CHARS): string {
  if (content.length <= maxChars) return content;
  
  // Try to truncate at a sentence boundary
  const truncated = content.substring(0, maxChars);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');
  
  const breakPoint = Math.max(lastPeriod, lastNewline);
  if (breakPoint > maxChars * 0.7) {
    return truncated.substring(0, breakPoint + 1) + '\n[Content truncated for efficiency]';
  }
  
  return truncated + '...[truncated]';
}

/**
 * Extract years of experience from bio text by finding "since YYYY", "X years", "established in YYYY", etc.
 */
function extractYearsFromBio(bioText: string | null | undefined): number | null {
  if (!bioText) return null;
  
  // Strip HTML tags if present
  const cleanText = stripHtmlAndClean(bioText);
  
  const foundYears: number[] = [];
  
  // Pattern 1: Direct year mentions like "15 years of experience", "over 20 years"
  const directYearPatterns = [
    /(\d+)\+?\s+years?\s+(?:of\s+)?(?:experience|in\s+(?:the\s+)?(?:business|industry|real\s+estate))/i,
    /(?:over|more\s+than|nearly)\s+(\d+)\s+years?/i,
  ];
  
  for (const pattern of directYearPatterns) {
    const match = cleanText.match(pattern);
    if (match && match[1]) {
      const years = parseInt(match[1], 10);
      if (years > 0 && years <= 70) { // Sanity check
        foundYears.push(years);
      }
    }
  }
  
  // Pattern 2: "Since YYYY", "established in YYYY", "began in YYYY", etc.
  const sinceYearPatterns = [
    /since\s+(\d{4})/i,
    /starting\s+in\s+(\d{4})/i,
    /began\s+in\s+(\d{4})/i,
    /started\s+in\s+(\d{4})/i,
    /established\s+(?:in\s+)?(\d{4})/i,
    /founded\s+(?:in\s+)?(\d{4})/i,
    /in\s+business\s+since\s+(\d{4})/i,
  ];
  
  const currentYear = new Date().getFullYear();
  for (const pattern of sinceYearPatterns) {
    const match = cleanText.match(pattern);
    if (match && match[1]) {
      const year = parseInt(match[1], 10);
      // Sanity check: year should be reasonable (not in the future, not before 1950)
      if (year >= 1950 && year <= currentYear) {
        foundYears.push(currentYear - year);
      }
    }
  }
  
  // Return the highest value found (most conservative estimate)
  return foundYears.length > 0 ? Math.max(...foundYears) : null;
}

/**
 * Fetch a single URL with timeout
 */
async function fetchUrlWithTimeout(
  url: string,
  supabaseUrl: string,
  supabaseKey: string,
  timeoutMs: number = 8000
): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/scrape-html`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, extractText: true }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`   ❌ HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data.success && data.parsedData?.bodyText) {
      const text = stripHtmlAndClean(data.parsedData.bodyText);
      if (text.length > 200) {
        console.log(`   ✅ Got ${text.length} chars`);
        return text;
      }
    }
    return null;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.log(`   ⏱️ Timeout after ${timeoutMs}ms`);
    } else {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
    return null;
  }
}

/**
 * Fetch website content with graceful failover - LIMITED TO 2 URLS MAX for speed
 */
async function fetchWebsiteContent(
  websiteUrl: string | null | undefined,
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ content: string; source: string } | null> {
  if (!websiteUrl) {
    console.log('📭 No website URL provided');
    return null;
  }

  // Clean up the URL
  let baseUrl = websiteUrl.trim();
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
  }
  baseUrl = baseUrl.replace(/\/+$/, '');

  // Only try base URL and /about - faster synthesis
  const urlsToTry = [baseUrl, `${baseUrl}/about`];

  let combinedContent = '';
  let successfulUrls: string[] = [];

  for (const url of urlsToTry) {
    console.log(`🌐 Fetching: ${url}`);
    const text = await fetchUrlWithTimeout(url, supabaseUrl, supabaseKey, 8000);
    if (text) {
      combinedContent += `\n\n--- Content from ${url} ---\n\n${text}`;
      successfulUrls.push(url);
      // If we got good content from base URL, skip /about
      if (text.length > 1000) break;
    }
  }

  if (combinedContent.length < 300) {
    console.log('📭 Insufficient website content collected');
    return null;
  }

  const truncatedContent = truncateContent(combinedContent, MAX_WEBSITE_CONTENT_CHARS);
  console.log(`✅ Website content: ${truncatedContent.length} chars from ${successfulUrls.length} page(s)`);
  
  return {
    content: truncatedContent,
    source: successfulUrls.join(', ')
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { professionalId, rawResearch, skipIfNoPress = false } = await req.json();

    // This function ONLY synthesizes from existing DB data.
    // The caller (e.g., BatchSynthesisRefresher) is responsible for running 
    // search-agent-press-gemini first if fresh press research is needed.
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
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');

    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    // Fetch existing professional data
    const { data: professional, error: fetchError } = await supabase
      .from('professionals')
      .select('*')
      .eq('id', professionalId)
      .single();

    if (fetchError) throw fetchError;

    // SYSTEM-WIDE: Extract years from bio and update if different
    const bioText = professional.get_to_know_me || professional.description || '';
    const extractedYears = extractYearsFromBio(bioText);
    
    if (extractedYears !== null && extractedYears !== professional.years_experience) {
      console.log(`📅 Bio-extracted years for ${professional.name}: ${extractedYears} (DB has: ${professional.years_experience})`);
      
      // Update years_experience in database
      const { error: yearsUpdateError } = await supabase
        .from('professionals')
        .update({ years_experience: extractedYears })
        .eq('id', professionalId);
      
      if (yearsUpdateError) {
        console.error('Error updating years_experience:', yearsUpdateError);
      } else {
        console.log(`✅ Updated years_experience to ${extractedYears} for ${professional.name}`);
      }
    }

    // Fetch website content (with graceful failover)
    console.log(`\n🌐 Attempting to fetch website for: ${professional.name}`);
    console.log(`   Website URL: ${professional.website || 'None'}`);
    
    const websiteData = await fetchWebsiteContent(
      professional.website,
      supabaseUrl,
      supabaseKey
    );

    // Read existing press mentions and community roles from DB
    // (The caller is responsible for running search-agent-press-gemini first if fresh data is needed)
    const geminiSearchResults = {
      pressMentions: professional.press_mentions || [],
      communityRoles: professional.community_roles || [],
      totalSearches: 0
    };

    // Prepare context for AI - gather all available data sources
    const confirmedYearsExperience = professional.years_experience || extractedYears;
    
    // Compile existing press mentions and community roles from DB
    // CRITICAL: press_mentions use 'source' for outlet name, not 'outlet' or 'title'
    const pressMentionsSummary = geminiSearchResults.pressMentions.length > 0 
      ? `=== PRESS MENTIONS ===\n${geminiSearchResults.pressMentions.map((pm: any) => {
          // Handle both formats: { source, url } or { outlet, title, url }
          const outletName = pm.source || pm.outlet || 'Unknown outlet';
          const url = pm.url || '';
          return `- ${outletName}${url ? ` (${url})` : ''}`;
        }).join('\n')}`
      : '';
    
    const communityRolesSummary = geminiSearchResults.communityRoles.length > 0
      ? `=== COMMUNITY ROLES ===\n${geminiSearchResults.communityRoles.map((cr: any) => 
          `- ${cr.role || cr.organization}: ${cr.description || ''}`
        ).join('\n')}`
      : '';
    
    const context = {
      name: professional.name,
      existingBio: professional.get_to_know_me || professional.description,
      existingPressData: professional.press_mentions || [],
      existingCommunityRoles: professional.community_roles || [],
      rawResearch: rawResearch || '',
      pressMentionsSummary,
      communityRolesSummary,
      geminiPressMentions: geminiSearchResults.pressMentions || [],
      professionalInformation: professional.professional_information || {},
      websiteContent: websiteData?.content || '',
      websiteSource: websiteData?.source || '',
      // Additional data that might contain achievements
      yearsExperience: confirmedYearsExperience,
      badges: professional.badges || [],
      specialty: professional.specialty || [],
      reviewCount: professional.num_total_reviews,
      rating: professional.review_stars_rating,
      company: professional.company || professional.business_name,
      city: professional.zillow_search_city,
    };

    console.log('\n📝 Synthesizing profile for:', professional.name);
    console.log(`   Bio length: ${(context.existingBio || '').length} chars`);
    console.log(`   Press mentions: ${context.existingPressData.length}`);
    console.log(`   Community roles: ${context.existingCommunityRoles.length}`);
    console.log(`   Website content: ${context.websiteContent.length} chars`);

    // STEP 2: Call Claude Sonnet for profile synthesis
    const systemPrompt = `You are writing a professional biography for a real estate agent directory optimized for AI search engines.

## OUTPUT REQUIREMENTS

### Length
150-200 words in 4 paragraphs with blank lines between each.

### Structure
Paragraph 1: Name, brokerage, years active, headline stat (transactions and/or reviews)
Paragraph 2: Credentials — education, certifications, professional designations
Paragraph 3: Recognition — press mentions, awards, rankings (cite specific publications by name)
Paragraph 4: Community involvement — church/faith community, charities, nonprofit board seats, volunteer work, coaching, mentoring, sponsorships, fundraising, community events, school involvement, youth sports, civic organizations, professional associations leadership

### Formatting
Use **bold** markdown for these CATEGORIES (apply to whatever data exists for each agent):
- Numbers and statistics (transaction counts, review counts, ratings, years, percentages, dollar amounts raised)
- Certifications and designations (any professional credential acronyms or full names)
- Awards and honors (any named award, club, or recognition)
- Press and media outlets (any publication, news source, or media mention)
- Community roles (board positions, volunteer titles, leadership roles, committee chairs)
- Named charitable organizations (any nonprofit, charity, church program, civic group, foundation, school, youth organization)
- Event names (galas, fundraisers, tournaments, drives)

Do NOT bold:
- People's names
- Brokerage names
- City or location names
- Generic words like "experience", "service", "clients", "transactions"

### CRITICAL: What to NEVER include
- Cities, neighborhoods, or service areas (this is premium content)
- Zip codes or geographic regions
- Property listings or current inventory
- Promotional language ("Call today!")
- Unverifiable superlatives ("best agent in Phoenix")

### Content Rules
- Write in third person
- Lead with verifiable facts, not opinions
- Include specific numbers when available
- Name press outlets and awards specifically — generic "award-winning" is worthless
- If no press mentions exist, skip paragraph 3 (do not invent)
- If no community involvement data exists, skip paragraph 4 (do not invent)
- For paragraph 4, include ALL community activities found: volunteer work, board memberships, sponsorships, coaching, faith community service, charitable donations, event organizing, mentoring programs

### CRITICAL: Paraphrasing Requirement
- NEVER copy phrases verbatim from the existing bio — completely rephrase everything
- If bio says "unwavering passion and integrity", write something like "a commitment to excellence and honest practice"
- If bio says "extensive local knowledge", write something like "deep understanding of the market" or "years of hands-on experience"
- Transform every phrase into your own words while preserving the meaning
- Using the same adjectives or phrasing as the source is FORBIDDEN

## EXAMPLE OUTPUT

Adam Hamblen has led the Hamblen Team at Realty One Group since **2003**, completing over **3,500 transactions** with a **5-star rating** across **1,000+ reviews**.

An Arizona native with degrees from ASU and Ottawa University, Hamblen holds elite certifications including **Certified Luxury Home Marketing Specialist (CLHMS)** and **Certified Negotiation Expert (CNE)**. He's been a **Dave Ramsey Endorsed Local Provider** since 2010.

His market insights have been featured in **Phoenix Business Journal**, **AZCentral**, and **Phoenix Agent Magazine**. The Hamblen Team has earned Realty One Group's **President's Circle Award** three consecutive years and ranks in the **top 1% of agents nationwide**.

Beyond real estate, Hamblen serves as a **board member** for **Habitat for Humanity** and has volunteered as a **youth pastor** for **29 years** at his local church. He sponsors the annual **Hamblen Team Little League Tournament**, has raised over **$150,000** for the **Make-A-Wish Foundation**, and mentors emerging agents through Realty One Group's **Regional Mentor Program**.`;

    const userPrompt = `Create a 150-200 word professional biography for this agent following the exact 4-paragraph structure.

AGENT DATA:
- Name: ${context.name}
- Brokerage: ${context.company || 'Unknown'}
- Years Active: ${context.yearsExperience ? `since ${new Date().getFullYear() - context.yearsExperience}` : 'Unknown'}
- Reviews: ${context.reviewCount || 0} reviews (${context.rating || 0} stars)
- Total Sales: Check agent_sales_stats if available

=== PERPLEXITY WEB RESEARCH (PRIMARY SOURCE - USE THIS FIRST) ===
${context.rawResearch || 'No web research available'}

=== PRESS MENTIONS (cite these outlet names in paragraph 3) ===
${(() => {
  const allMentions = [...(context.geminiPressMentions || []), ...(context.existingPressData || [])];
  if (allMentions.length === 0) return 'No press mentions available';
  // Format each mention clearly with source/outlet as the key info
  return allMentions.map((pm: any) => {
    const outlet = pm.source || pm.outlet || 'Unknown';
    const url = pm.url || '';
    const title = pm.title && !pm.title.startsWith('Source ') ? pm.title : '';
    return `- OUTLET: ${outlet}${title ? ` | TITLE: ${title}` : ''}${url ? ` | URL: ${url}` : ''}`;
  }).join('\n');
})()}

=== WEBSITE CONTENT (from ${context.websiteSource || 'their website'}) ===
${context.websiteContent || 'NO WEBSITE CONTENT AVAILABLE'}

=== EXISTING BIO (COMPLETELY REPHRASE - copying any phrases verbatim is FORBIDDEN) ===
${context.existingBio || 'No bio available'}

=== EXISTING COMMUNITY ROLES (include ALL of these in paragraph 4) ===
${context.existingCommunityRoles?.length > 0 ? JSON.stringify(context.existingCommunityRoles, null, 2) : 'No existing community roles - search bio and website for volunteer work, board seats, charity involvement'}

REMEMBER:
- 4 paragraphs with blank lines between each
- Bold numbers, certifications, awards, press outlets, community roles, charities
- Do NOT bold names, brokerages, locations, or generic words
- NEVER include cities, neighborhoods, or service areas
- Skip paragraph 3 if no press/awards exist
- For paragraph 4: THOROUGHLY search all sources for community involvement - volunteer work, nonprofit boards, charity donations, church/faith community, youth sports coaching, school involvement, civic organizations, professional association leadership. Include EVERY community activity found with specific organization names.
- Skip paragraph 4 ONLY if absolutely no community involvement exists anywhere in the data`;

    // Try Claude first, fall back to OpenAI GPT-4o on failure
    let synthesizedData: any;
    let usedFallback = false;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    try {
      const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicApiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [
            { role: 'user', content: userPrompt }
          ],
          tools: [
            {
              name: 'synthesize_profile',
              description: 'Create a 150-200 word professional biography in 4 paragraphs with markdown bold formatting for key categories',
              input_schema: {
                type: 'object',
                properties: {
                  synthesized_bio: {
                    type: 'string',
                    description: '150-200 word biography in 4 paragraphs. Bold numbers/stats, certifications, awards, press outlets, community roles, and charities. Do NOT bold names, brokerages, locations. Never include cities/neighborhoods/service areas.'
                  },
                  specialties_extracted: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of specialties extracted from website/bio (investors, luxury, first-time buyers, etc.)'
                  },
                  notable_achievements: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string' },
                        description: { type: 'string' },
                        date: { type: 'string', description: 'Year or date if available (YYYY format)' },
                        credibility: { type: 'number', description: 'Score 1-10' },
                        source: { type: 'string' },
                        source_url: { type: 'string', description: 'URL of the source if available' }
                      },
                      required: ['title', 'description', 'credibility']
                    },
                    description: 'Include PERSONAL achievements (valedictorian, scholarships, degrees) and PROFESSIONAL achievements (awards, rankings)'
                  },
                  publications: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string' },
                        type: { type: 'string', description: 'book, article, etc.' },
                        publisher: { type: 'string' },
                        date: { type: 'string', description: 'Year or date' },
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
                        organization: { type: 'string', description: 'Name of charity, nonprofit, or community organization' },
                        role: { type: 'string', description: 'Their role (supporter, board member, volunteer, founder, etc.)' },
                        description: { type: 'string', description: 'What they do for this organization' }
                      },
                      required: ['organization', 'role']
                    },
                    description: 'Charities supported, nonprofits, volunteer work, community involvement - PRIORITIZE extracting this'
                  },
                  awards_verified: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        award_name: { type: 'string', description: 'Name of the award' },
                        year: { type: 'string', description: 'Year awarded (YYYY format)' },
                        awarding_organization: { type: 'string', description: 'Organization that gave the award' },
                        source_url: { type: 'string', description: 'URL of third-party source verifying the award' }
                      },
                      required: ['award_name']
                    },
                    description: 'Awards verified by third-party sources (industry awards, Top Producer, rankings)'
                  },
                  certifications_verified: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        designation: { type: 'string', description: 'Designation acronym (CRS, GRI, CCIM, etc.)' },
                        full_name: { type: 'string', description: 'Full name of the certification' },
                        verifying_organization: { type: 'string', description: 'Organization that issued/verified it' },
                        source_url: { type: 'string', description: 'URL of verification source' }
                      },
                      required: ['designation', 'full_name']
                    },
                    description: 'Certifications/designations verified by third-party sources'
                  }
                },
                required: ['synthesized_bio', 'notable_achievements', 'community_roles']
              }
            }
          ],
          tool_choice: { type: 'tool', name: 'synthesize_profile' }
        })
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('❌ Claude API error:', aiResponse.status, errorText);
        throw new Error(`Claude API error: ${aiResponse.status} - ${errorText}`);
      }

      const aiData = await aiResponse.json();
      console.log('AI response received (Claude)');

      // Extract tool call result from Claude's response format
      const toolUseBlock = aiData.content?.find((block: any) => block.type === 'tool_use');
      const toolCall = toolUseBlock ? { function: { arguments: JSON.stringify(toolUseBlock.input) } } : null;
      if (!toolCall) {
        throw new Error('No tool call in Claude response');
      }

      synthesizedData = JSON.parse(toolCall.function.arguments);
      
    } catch (claudeError: any) {
      // FAILOVER: Claude failed, try OpenAI GPT-4o
      console.error(`🚨 Claude synthesis failed: ${claudeError.message}`);
      
      if (!openaiApiKey) {
        throw new Error(`Claude failed and no OpenAI fallback available: ${claudeError.message}`);
      }
      
      console.log('🔄 [FAILOVER] Switching to OpenAI GPT-4o for synthesis...');
      usedFallback = true;
      
      // Send failover alert (fire and forget)
      sendFailoverAlert(
        professional.name,
        'Claude Sonnet',
        'OpenAI GPT-4o',
        claudeError.message
      ).catch(console.error);
      
      // Call OpenAI fallback
      synthesizedData = await callOpenAIFallback(systemPrompt, userPrompt, openaiApiKey);
      console.log('✅ OpenAI GPT-4o synthesis successful (failover)');
    }
    
    if (usedFallback) {
      console.log('⚠️ Used OpenAI GPT-4o fallback for this synthesis');
    }
    
    // Convert markdown bold (**text**) to HTML <strong> tags
    if (synthesizedData.synthesized_bio) {
      synthesizedData.synthesized_bio = synthesizedData.synthesized_bio
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    }
    
    console.log('Synthesized data:', JSON.stringify(synthesizedData, null, 2));

    // Sort achievements by credibility and deduplicate similar titles
    if (synthesizedData.notable_achievements) {
      synthesizedData.notable_achievements.sort((a: any, b: any) => 
        (b.credibility || 0) - (a.credibility || 0)
      );
      
      // Deduplicate similar achievement titles
      const seenTitles = new Set<string>();
      const uniqueAchievements = [];
      
      for (const achievement of synthesizedData.notable_achievements) {
        const normalizedTitle = (achievement.title || '').toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        let isDuplicate = false;
        for (const seenTitle of seenTitles) {
          const titleWords = normalizedTitle.split(' ');
          const seenWords = seenTitle.split(' ');
          const commonWords = titleWords.filter((w: string) => seenWords.includes(w));
          const similarity = commonWords.length / Math.max(titleWords.length, seenWords.length);
          
          if (similarity > 0.8) {
            isDuplicate = true;
            break;
          }
        }
        
        if (!isDuplicate) {
          uniqueAchievements.push(achievement);
          seenTitles.add(normalizedTitle);
        }
      }
      
      // Keep top 10 unique achievements
      synthesizedData.notable_achievements = uniqueAchievements.slice(0, 10);
    }

    // Merge extracted specialties with existing ones
    const existingSpecialties = professional.specialty || [];
    const extractedSpecialties = synthesizedData.specialties_extracted || [];
    const mergedSpecialties = [...new Set([...existingSpecialties, ...extractedSpecialties])];

    // CRITICAL: Merge achievements instead of replacing - preserve high-credibility items
    const existingAchievements = professional.notable_achievements || [];
    const newAchievements = synthesizedData.notable_achievements || [];
    
    // Keep existing achievements with credibility >= 8 (like WSJ, Fox Business mentions)
    const highCredibilityExisting = existingAchievements.filter((a: any) => 
      (a.credibility || 0) >= 8
    );
    
    // Combine: high-credibility existing + new achievements, then dedupe
    const combinedAchievements = [...highCredibilityExisting, ...newAchievements];
    
    // Deduplicate by normalized title
    const seenTitles = new Set<string>();
    const mergedAchievements = [];
    for (const achievement of combinedAchievements) {
      const normalizedTitle = (achievement.title || '').toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (!seenTitles.has(normalizedTitle) && normalizedTitle.length > 0) {
        mergedAchievements.push(achievement);
        seenTitles.add(normalizedTitle);
      }
    }
    
    // Sort by credibility and keep top 15
    mergedAchievements.sort((a: any, b: any) => (b.credibility || 0) - (a.credibility || 0));
    const finalAchievements = mergedAchievements.slice(0, 15);
    
    console.log(`   📊 Achievements: ${highCredibilityExisting.length} preserved + ${newAchievements.length} new = ${finalAchievements.length} final`);

    // Update professional record
    const updateData: Record<string, any> = {
      synthesized_bio: synthesizedData.synthesized_bio,
      notable_achievements: finalAchievements,
      publications: synthesizedData.publications || [],
      community_roles: synthesizedData.community_roles || [],
      awards_verified: synthesizedData.awards_verified || [],
      certifications_verified: synthesizedData.certifications_verified || [],
      profile_last_synthesized_at: new Date().toISOString()
    };

    // Only update specialties if we extracted new ones
    if (extractedSpecialties.length > 0 && mergedSpecialties.length > existingSpecialties.length) {
      updateData.specialty = mergedSpecialties;
      console.log(`   ✅ Added ${mergedSpecialties.length - existingSpecialties.length} new specialties`);
    }

    // Store areas served if extracted
    if (synthesizedData.areas_served && synthesizedData.areas_served.length > 0) {
      // Could be stored in service_areas field if needed
      console.log(`   📍 Areas served: ${synthesizedData.areas_served.join(', ')}`);
    }

    const { error: updateError } = await supabase
      .from('professionals')
      .update(updateData)
      .eq('id', professionalId);

    if (updateError) throw updateError;

    console.log('✅ Profile synthesis complete for:', professional.name);
    console.log(`   Synthesis: ${synthesizedData.synthesized_bio?.substring(0, 100)}...`);

    return new Response(
      JSON.stringify({
        success: true,
        data: synthesizedData,
        websiteUsed: !!websiteData
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
