import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Extract years of experience from bio text by finding "since YYYY", "X years", "established in YYYY", etc.
 */
function extractYearsFromBio(bioText: string | null | undefined): number | null {
  if (!bioText) return null;
  
  // Strip HTML tags if present
  const cleanText = bioText.replace(/<[^>]*>/g, ' ');
  
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
        const text = data.parsedData.bodyText;
        // Only include if we got substantial content (more than 200 chars)
        if (text.length > 200) {
          combinedContent += `\n\n--- Content from ${url} ---\n\n${text}`;
          successfulUrls.push(url);
          console.log(`   ✅ Got ${text.length} chars`);
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

  console.log(`✅ Website content collected from ${successfulUrls.length} page(s)`);
  return {
    content: combinedContent.slice(0, 25000), // Cap at 25k chars for AI context
    source: successfulUrls.join(', ')
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { professionalId, rawResearch, skipIfNoPress = false } = await req.json();

    // Note: skipIfNoPress is now false by default to ensure achievements are always extracted
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

    // Prepare context for AI - gather all available data sources
    const confirmedYearsExperience = professional.years_experience || extractedYears;
    
    const context = {
      name: professional.name,
      existingBio: professional.get_to_know_me || professional.description,
      existingPressData: professional.press_mentions || [],
      rawResearch: rawResearch || '',
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
    console.log(`   Raw research: ${context.rawResearch.length} chars`);
    console.log(`   Website content: ${context.websiteContent.length} chars`);
    console.log(`   Website source: ${context.websiteSource || 'None'}`);

    // Call Claude Sonnet with tool calling for structured extraction
    const systemPrompt = `You are a professional profile synthesizer for a real estate agent directory. Your job is to create a compelling 3-5 sentence synthesis about THE AGENT by combining ALL available data sources.

CRITICAL: SYNTHESIZE FROM ALL SOURCES
You must weave together information from:
- Their personal website (if available)
- Press mentions and media coverage (IMPORTANT - mention notable press if available!)
- Awards and achievements  
- Existing Zillow/profile bio (but NEVER just copy it - always rewrite and enhance)
- Review data and ratings
- Specialties and areas served

SYNTHESIS RULES:
1. Write in third-person, present tense
2. The synthesis should be 3-5 sentences covering:
   - Areas/neighborhoods they serve (if known)
   - Specialties (investors, luxury, first-time buyers, relocation, etc.)
   - Awards, recognition, and PRESS MENTIONS (if any - these are credibility boosters!)
   - What makes them unique (brokerage ownership, team leadership, niche expertise)
   - You may mention "beginning in [year]" or "serving since [year]" but DO NOT state a specific years of experience number
3. DO NOT mention:
   - Specific properties or listings
   - Property prices or addresses
   - Current inventory
   - Open house schedules
4. Be factual - only include information explicitly found in the provided data
5. If they own their brokerage, mention that (shows commitment)
6. If they have press mentions (featured in publications), MENTION them - this is credibility gold!
7. NEVER just copy the Zillow bio verbatim - always synthesize and enhance with other data

IMPORTANT ON FAILOVER:
If no website content is available, you MUST still create a compelling synthesis by combining:
- The Zillow bio (reworded, not copied)
- Any press mentions (PRIORITIZE these!)
- Awards and achievements
- Specialties and service areas
- Review/rating data

ADDITIONAL EXTRACTION RULES:
1. Convert all first-person language to third-person
2. Extract notable achievements, awards, certifications from ALL data sources
3. Rank achievements by credibility (1-10): press mentions = 9-10, website = 6-8, existing bio = 5-7
4. Deduplicate information across sources
5. **ALWAYS INCLUDE DATES**: Extract year for EVERY achievement when available`;

    const userPrompt = `Synthesize this agent profile by combining ALL available data sources:

AGENT INFORMATION:
- Name: ${context.name}
- Brokerage: ${context.company || 'Unknown'}
- Location: ${context.city || 'Unknown'}
- Confirmed Years Experience: ${context.yearsExperience || 'Unknown'} (use this for reference but write "since [year]" or "beginning in [year]" in synthesis instead of stating years)
- Specialties: ${context.specialty.join(', ') || 'None listed'}
- Reviews: ${context.reviewCount || 0} reviews (${context.rating || 0} stars)
- Badges: ${context.badges.join(', ') || 'None'}

=== WEBSITE CONTENT (from ${context.websiteSource || 'their website'}) ===
${context.websiteContent || 'NO WEBSITE CONTENT AVAILABLE - use other sources below'}

=== EXISTING ZILLOW BIO (reword this, do NOT copy verbatim) ===
${context.existingBio || 'No bio available'}

=== PRESS MENTIONS (HIGH PRIORITY - include these in synthesis!) ===
${context.existingPressData.length > 0 ? JSON.stringify(context.existingPressData, null, 2) : 'No press mentions available'}

=== RAW PRESS RESEARCH ===
${context.rawResearch || 'No press research available'}

=== PROFILE INFORMATION ===
${JSON.stringify(context.professionalInformation, null, 2)}

INSTRUCTIONS: 
- Create a compelling 3-5 sentence synthesis focused on WHO THE AGENT IS
- COMBINE all sources above - don't rely on just one
- If they have press mentions, MENTION them (e.g., "featured in Arizona Republic" or "recognized by Phoenix Business Journal")
- If no website content, reword the Zillow bio and enhance with press/achievements
- Do NOT mention specific properties, prices, addresses, or inventory
- If you know their start year, you can say "serving since [year]" but do NOT state a specific years count`;

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
            description: 'Extract structured profile data including synthesis and achievements',
            input_schema: {
              type: 'object',
              properties: {
                synthesized_bio: {
                  type: 'string',
                  description: '3-5 sentence synthesis about THE AGENT - their experience, areas served, specialties, awards, and what makes them unique. NO property listings or inventory.'
                },
                areas_served: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of areas/neighborhoods the agent serves'
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
                  }
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
                      organization: { type: 'string' },
                      role: { type: 'string' },
                      description: { type: 'string' }
                    },
                    required: ['organization', 'role']
                  }
                }
              },
              required: ['synthesized_bio', 'notable_achievements']
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
