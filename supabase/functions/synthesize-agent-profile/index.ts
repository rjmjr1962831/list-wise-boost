import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// TOKEN OPTIMIZATION: Maximum characters for website content (reduced from 25K to 8K)
const MAX_WEBSITE_CONTENT_CHARS = 8000;

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
 * Fetch website content with graceful failover
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
  // Remove trailing slash for consistency
  baseUrl = baseUrl.replace(/\/+$/, '');

  const urlsToTry = [
    baseUrl,
    `${baseUrl}/about`,
    `${baseUrl}/about-us`,
    `${baseUrl}/bio`,
    `${baseUrl}/meet-the-team`,
    `${baseUrl}/team`,
  ];

  let combinedContent = '';
  let successfulUrls: string[] = [];

  for (const url of urlsToTry) {
    try {
      console.log(`🌐 Fetching: ${url}`);
      
      const response = await fetch(`${supabaseUrl}/functions/v1/scrape-html`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          extractText: true,
        }),
      });

      if (!response.ok) {
        console.log(`   ❌ HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();
      
      if (data.success && data.parsedData?.bodyText) {
        // TOKEN OPTIMIZATION: Strip HTML and clean the text
        let text = stripHtmlAndClean(data.parsedData.bodyText);
        
        // Only include if we got substantial content (more than 200 chars)
        if (text.length > 200) {
          combinedContent += `\n\n--- Content from ${url} ---\n\n${text}`;
          successfulUrls.push(url);
          console.log(`   ✅ Got ${text.length} chars (cleaned)`);
        } else {
          console.log(`   ⚠️ Content too short (${text.length} chars)`);
        }
      } else {
        console.log(`   ⚠️ No body text extracted`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
      continue;
    }
  }

  if (combinedContent.length < 300) {
    console.log('📭 Insufficient website content collected');
    return null;
  }

  // TOKEN OPTIMIZATION: Truncate to max chars for AI context (reduced from 25K to 8K)
  const truncatedContent = truncateContent(combinedContent, MAX_WEBSITE_CONTENT_CHARS);
  console.log(`✅ Website content collected from ${successfulUrls.length} page(s), ${truncatedContent.length} chars (capped at ${MAX_WEBSITE_CONTENT_CHARS})`);
  
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
    const { professionalId, rawResearch, skipIfNoPress = false, skipGeminiSearch = false } = await req.json();

    // skipGeminiSearch: If true, skip the Gemini search (useful when caller already ran it)
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

    // STEP 1: Call Gemini Flash for iterative web search (FREE) - SKIP if caller already did it
    let geminiSearchResults = null;
    
    if (skipGeminiSearch) {
      console.log(`\n⏭️ Skipping Gemini search (caller already ran it)`);
      // Fetch the already-saved press mentions and community roles from DB
      geminiSearchResults = {
        pressMentions: professional.press_mentions || [],
        communityRoles: professional.community_roles || [],
        totalSearches: 0
      };
    } else {
      console.log(`\n🔍 Running Gemini Flash iterative web search for: ${professional.name}`);
      try {
        const geminiResponse = await fetch(`${supabaseUrl}/functions/v1/search-agent-press-gemini`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            agentName: professional.name,
            brokerage: professional.company || professional.business_name,
            city: professional.zillow_search_city,
            state: 'Arizona',
            zillowUrl: professional.zillow_profile_url,
            professionalId: professionalId,
            dryRun: true // Don't save press mentions yet - we'll do that after synthesis
          }),
        });

        if (geminiResponse.ok) {
          geminiSearchResults = await geminiResponse.json();
          console.log(`   ✅ Gemini search complete: ${geminiSearchResults.totalSearches} searches, ${geminiSearchResults.pressMentions?.length || 0} press mentions found`);
        } else {
          console.log(`   ⚠️ Gemini search failed: ${geminiResponse.status}`);
        }
      } catch (searchError) {
        console.log(`   ⚠️ Gemini search error: ${searchError instanceof Error ? searchError.message : 'Unknown'}`);
      }
    }

    // Prepare context for AI - gather all available data sources
    const confirmedYearsExperience = professional.years_experience || extractedYears;
    
    // Compile web search findings into a structured summary
    const webSearchFindings = geminiSearchResults ? `
=== WEB SEARCH FINDINGS (${geminiSearchResults.totalSearches} searches performed) ===
${geminiSearchResults.phases?.map((phase: any) => `
Phase ${phase.phase}: ${phase.queries?.length || 0} queries
${phase.analysis || 'No analysis'}
Results: ${phase.results?.map((r: any) => `- ${r.title}: ${r.snippet}`).join('\n') || 'None'}
`).join('\n') || 'No phase data'}

=== PRESS MENTIONS DISCOVERED ===
${geminiSearchResults.pressMentions?.map((pm: any) => 
  `- ${pm.title} (${pm.outlet || 'Unknown outlet'}, credibility: ${pm.credibilityScore || 'N/A'})`
).join('\n') || 'No press mentions found'}
` : '';
    
    const context = {
      name: professional.name,
      existingBio: professional.get_to_know_me || professional.description,
      existingPressData: professional.press_mentions || [],
      existingCommunityRoles: professional.community_roles || [],
      rawResearch: rawResearch || '',
      webSearchFindings: webSearchFindings,
      geminiPressMentions: geminiSearchResults?.pressMentions || [],
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
    console.log(`   Press mentions (existing): ${context.existingPressData.length}`);
    console.log(`   Press mentions (from search): ${context.geminiPressMentions.length}`);
    console.log(`   Raw research: ${context.rawResearch.length} chars`);
    console.log(`   Web search findings: ${context.webSearchFindings.length} chars`);
    console.log(`   Website content: ${context.websiteContent.length} chars`);
    console.log(`   Website source: ${context.websiteSource || 'None'}`);

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

=== PRESS MENTIONS FROM WEB SEARCH ===
${context.geminiPressMentions?.length > 0 ? JSON.stringify(context.geminiPressMentions, null, 2) : 'No press mentions discovered'}

=== EXISTING PRESS MENTIONS ===
${context.existingPressData.length > 0 ? JSON.stringify(context.existingPressData, null, 2) : 'No existing press mentions'}

=== WEBSITE CONTENT (from ${context.websiteSource || 'their website'}) ===
${context.websiteContent || 'NO WEBSITE CONTENT AVAILABLE'}

=== EXISTING BIO (paraphrase, do NOT copy verbatim) ===
${context.existingBio || 'No bio available'}

=== WEB SEARCH FINDINGS ===
${context.webSearchFindings || 'No web search results available'}

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
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response received');

    // Extract tool call result from Claude's response format
    const toolUseBlock = aiData.content?.find((block: any) => block.type === 'tool_use');
    const toolCall = toolUseBlock ? { function: { arguments: JSON.stringify(toolUseBlock.input) } } : null;
    if (!toolCall) {
      throw new Error('No tool call in AI response');
    }

    const synthesizedData = JSON.parse(toolCall.function.arguments);
    
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

    // Update professional record
    const updateData: Record<string, any> = {
      synthesized_bio: synthesizedData.synthesized_bio,
      notable_achievements: synthesizedData.notable_achievements || [],
      publications: synthesizedData.publications || [],
      community_roles: synthesizedData.community_roles || [],
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
