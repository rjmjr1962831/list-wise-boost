import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      agentName, 
      company, 
      businessName, 
      city, 
      state, 
      professionalId, 
      dryRun = false,
      skipIfNoPress = true 
    } = await req.json();

    if (!agentName) {
      return new Response(
        JSON.stringify({ error: 'Agent name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Initialize Supabase client for synthesis integration
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      console.error('ANTHROPIC_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Searching press mentions for ${agentName} with Claude Web Search (Enhanced)`);

    // Comprehensive system prompt to guide Claude
    const systemPrompt = `You are a research assistant finding press mentions and web presence for real estate professionals.

Search multiple angles to build a comprehensive profile:
- Agent name + company/team name variations
- Industry awards (Wall Street Journal Real Trends Top 250, America's Best Real Estate Agents, Inc 500, local awards)
- Local TV news appearances (Fox, ABC, NBC, CBS affiliates)
- Podcasts (guest appearances, hosted shows)
- Industry publications (Inman, HousingWire, Real Producer Magazine, Ranking Arizona)
- Speaking engagements, coaching, conferences
- Business achievements and recognition

Important: The Wall Street Journal rankings and similar lists are often cited by OTHER sources (like real estate websites, local news, industry blogs), so search for references to these achievements even if the original source is paywalled.

Exclude generic real estate listing sites (Zillow agent profiles, Realtor.com, Redfin profiles) - we want PRESS and RECOGNITION, not just profiles.

Return your findings as a JSON array with: title, source, url, snippet, date (YYYY-MM-DD or 'NA'), type (tv_appearance, award, article, interview, podcast, speaking_engagement, or recognition).`;

    // Enhanced user query with city context
    const userQuery = `Find the complete web presence and press mentions for ${agentName}${businessName ? ` (${businessName})` : ''}${company ? ` at ${company}` : ''}, a real estate professional in ${city}, ${state}.

Search for:
1. Industry awards and rankings (WSJ Real Trends, local "Top Agent" lists, Inc 500)
2. TV/radio appearances on local news stations
3. Podcast interviews or hosted shows
4. Articles in real estate industry publications
5. Speaking engagements at conferences or events
6. Any other press coverage or recognition

Look for references to achievements even if cited by secondary sources.`;

    // Call Claude with enhanced configuration
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',  // Upgraded from haiku for better research
        max_tokens: 5000,             // Increased from 1500 for comprehensive results
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userQuery
          }
        ],
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: 6  // Increased from 2 for multi-angle searching
          }
        ],
        tool_choice: { type: 'auto' }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', response.status, errorText);
      
      // Pass through rate limit errors with proper status code
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limited', details: errorText }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Claude API request failed', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('Claude response received');

    // Extract press mentions from Claude's response AND capture full research text
    const mentions: any[] = [];
    let fullResearchText = '';
    
    // Look through the content blocks for text responses
    if (data.content) {
      for (const block of data.content) {
        if (block.type === 'text' && block.text) {
          // Capture all text for synthesis
          fullResearchText += block.text + '\n\n';
          
          try {
            // Try to extract JSON from the text
            const jsonMatch = block.text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const parsedMentions = JSON.parse(jsonMatch[0]);
              if (Array.isArray(parsedMentions)) {
                mentions.push(...parsedMentions);
              }
            }
          } catch (e) {
            console.error('Failed to parse JSON from Claude response:', e);
          }
        }
      }
    }

    // Enhanced deduplication: check both URL and content similarity
    const uniqueMentions = new Map();
    const seenTitles = new Set<string>();
    
    mentions.forEach(mention => {
      if (!mention.url) return;
      
      // Normalize title for duplicate detection
      const normalizedTitle = (mention.title || '').toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Check if we've seen a very similar title (same award from different sources)
      let isDuplicate = false;
      for (const seenTitle of seenTitles) {
        // If 80% of words match, consider it a duplicate
        const titleWords = normalizedTitle.split(' ');
        const seenWords = seenTitle.split(' ');
        const commonWords = titleWords.filter((w: string) => seenWords.includes(w));
        const similarity = commonWords.length / Math.max(titleWords.length, seenWords.length);
        
        if (similarity > 0.8) {
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate && !uniqueMentions.has(mention.url)) {
        // Assign credibility score based on type and source
        let credibilityScore = 5;
        const lowerSource = (mention.source || '').toLowerCase();
        const type = mention.type || 'article';
        
        if (type === 'tv_appearance') credibilityScore = 10;
        else if (type === 'award') credibilityScore = 9;
        else if (lowerSource.includes('wall street') || lowerSource.includes('forbes')) credibilityScore = 10;
        else if (lowerSource.includes('ranking arizona') || lowerSource.includes('real producers')) credibilityScore = 9;
        else if (lowerSource.includes('fox') || lowerSource.includes('nbc') || lowerSource.includes('abc')) credibilityScore = 8;
        
        uniqueMentions.set(mention.url, {
          ...mention,
          credibilityScore
        });
        seenTitles.add(normalizedTitle);
      }
    });

    // Convert to array and sort by credibility
    const finalMentions = Array.from(uniqueMentions.values())
      .sort((a, b) => (b.credibilityScore || 0) - (a.credibilityScore || 0))
      .slice(0, 10); // Top 10 unique mentions

    console.log(`Found ${finalMentions.length} press mentions for ${agentName}`);

    // Auto-trigger profile synthesis if professionalId provided
    const shouldSynthesize = professionalId && fullResearchText.trim() && !dryRun;
    const hasPress = finalMentions.length > 0;
    
    if (shouldSynthesize && (!skipIfNoPress || hasPress)) {
      console.log(`🔄 Auto-triggering profile synthesis for ${agentName}...`);
      
      try {
        // Call synthesize-agent-profile in background (don't await to avoid blocking response)
        supabase.functions.invoke('synthesize-agent-profile', {
          body: {
            professionalId,
            skipIfNoPress,
            rawResearch: `# Press Research for ${agentName}

## Context
Agent: ${agentName}
${company ? `Company: ${company}` : ''}
${businessName ? `Business: ${businessName}` : ''}
Location: ${city}, ${state}

## Research Results
${fullResearchText}

## Press Mentions Found
${JSON.stringify(finalMentions, null, 2)}`
          }
        }).then(({ data: synthData, error: synthError }) => {
          if (synthError) {
            console.error('❌ Profile synthesis failed:', synthError);
          } else {
            console.log('✅ Profile synthesis completed successfully');
          }
        }).catch(err => {
          console.error('❌ Profile synthesis error:', err);
        });
      } catch (synthError) {
        console.error('❌ Failed to trigger synthesis:', synthError);
        // Don't block the response on synthesis failure
      }
    } else if (dryRun) {
      console.log('🔧 DRY RUN: Would trigger synthesis for', agentName);
    } else if (skipIfNoPress && !hasPress) {
      console.log('💰 COST SAVE: Skipping synthesis (no press found, skipIfNoPress=true)');
    } else if (professionalId && !fullResearchText.trim()) {
      console.log('⚠️ No research text captured for synthesis');
    } else {
      console.log('ℹ️ No professionalId provided, skipping auto-synthesis');
    }

    return new Response(
      JSON.stringify({ mentions: finalMentions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-agent-press-claude:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
