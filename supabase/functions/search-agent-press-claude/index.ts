import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Send failover alert email
async function sendFailoverAlert(
  supabase: any,
  provider: string,
  error: string,
  agentName: string
) {
  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured, cannot send failover alert');
      return;
    }

    const emailBody = `
AI Provider Failover Alert

Provider: ${provider}
Error: ${error}
Agent Being Processed: ${agentName}
Time: ${new Date().toISOString()}

Action Required:
${provider === 'Anthropic/Claude' ? 
  '1. Check Anthropic credit balance: https://console.anthropic.com/settings/billing\n2. Add credits or update payment method if needed' :
  '1. Check the provider status and API key configuration\n2. Review error logs for details'}

The system automatically failed over to Lovable AI (Gemini) to complete this request.
`;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Top10Lists <alerts@top10lists.us>',
        to: ['robert@top10lists.us'],
        subject: `⚠️ AI Failover Alert: ${provider} failed - switched to backup`,
        text: emailBody,
      }),
    });

    if (response.ok) {
      console.log('✅ Failover alert email sent to robert@top10lists.us');
    } else {
      const errorText = await response.text();
      console.error('Failed to send failover alert email:', errorText);
    }
  } catch (emailError) {
    console.error('Error sending failover alert:', emailError);
  }
}

// Call Claude API
async function callClaudeAPI(systemPrompt: string, userQuery: string, anthropicApiKey: string) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 5000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userQuery }],
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 6
        }
      ],
      tool_choice: { type: 'auto' }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

// Call Lovable AI (Gemini) as fallback
async function callLovableAI(systemPrompt: string, userQuery: string) {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableApiKey) {
    throw new Error('LOVABLE_API_KEY not configured');
  }

  // Enhanced prompt for Gemini that simulates research
  const enhancedPrompt = `${systemPrompt}

IMPORTANT: Since you cannot perform live web searches, use your training knowledge to identify likely press mentions, awards, and recognition for this real estate professional. Focus on:
- Major industry awards they might have received (WSJ Real Trends, local top agent lists)
- Types of media coverage common for top agents in their area
- Industry publications that feature successful agents

If you don't have specific information, provide a structured response indicating no verified press mentions were found.

${userQuery}

Respond with a JSON array of any known mentions. If uncertain, return an empty array [].`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: enhancedPrompt }
      ],
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lovable AI error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  
  // Convert to Claude-like response format
  return {
    content: [{
      type: 'text',
      text: data.choices?.[0]?.message?.content || '[]'
    }],
    provider: 'lovable-ai-fallback'
  };
}

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

    console.log(`Searching press mentions for ${agentName} with AI (Claude primary, Lovable fallback)`);

    // Comprehensive system prompt
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

    const userQuery = `Find the complete web presence and press mentions for ${agentName}${businessName ? ` (${businessName})` : ''}${company ? ` at ${company}` : ''}, a real estate professional in ${city}, ${state}.

Search for:
1. Industry awards and rankings (WSJ Real Trends, local "Top Agent" lists, Inc 500)
2. TV/radio appearances on local news stations
3. Podcast interviews or hosted shows
4. Articles in real estate industry publications
5. Speaking engagements at conferences or events
6. Any other press coverage or recognition

Look for references to achievements even if cited by secondary sources.`;

    let data: any;
    let usedFallback = false;
    let failoverError = '';

    // Try Claude first, fall back to Lovable AI
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    
    if (anthropicApiKey) {
      try {
        console.log('🔵 Attempting Claude API...');
        data = await callClaudeAPI(systemPrompt, userQuery, anthropicApiKey);
        console.log('✅ Claude API succeeded');
      } catch (claudeError) {
        const errorMsg = claudeError instanceof Error ? claudeError.message : String(claudeError);
        console.error('❌ Claude API failed:', errorMsg);
        failoverError = errorMsg;
        
        // Check if it's a credits/billing issue
        const isCreditsIssue = errorMsg.includes('credit balance') || 
                               errorMsg.includes('billing') || 
                               errorMsg.includes('payment') ||
                               errorMsg.includes('402');
        
        console.log(`⚠️ Failing over to Lovable AI (Gemini)... Reason: ${isCreditsIssue ? 'Credits issue' : 'API error'}`);
        
        try {
          data = await callLovableAI(systemPrompt, userQuery);
          usedFallback = true;
          console.log('✅ Lovable AI fallback succeeded');
          
          // Send alert email about the failover
          await sendFailoverAlert(supabase, 'Anthropic/Claude', errorMsg, agentName);
        } catch (fallbackError) {
          console.error('❌ Lovable AI fallback also failed:', fallbackError);
          throw new Error(`Both Claude and Lovable AI failed. Claude: ${errorMsg}. Fallback: ${fallbackError}`);
        }
      }
    } else {
      // No Anthropic key configured, use Lovable AI directly
      console.log('⚠️ ANTHROPIC_API_KEY not configured, using Lovable AI directly');
      data = await callLovableAI(systemPrompt, userQuery);
      usedFallback = true;
    }

    console.log(`Response received from ${usedFallback ? 'Lovable AI (fallback)' : 'Claude'}`);

    // Extract press mentions from response
    const mentions: any[] = [];
    let fullResearchText = '';
    
    if (data.content) {
      for (const block of data.content) {
        if (block.type === 'text' && block.text) {
          fullResearchText += block.text + '\n\n';
          
          try {
            const jsonMatch = block.text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const parsedMentions = JSON.parse(jsonMatch[0]);
              if (Array.isArray(parsedMentions)) {
                mentions.push(...parsedMentions);
              }
            }
          } catch (e) {
            console.error('Failed to parse JSON from response:', e);
          }
        }
      }
    }

    // Enhanced deduplication
    const uniqueMentions = new Map();
    const seenTitles = new Set<string>();
    
    mentions.forEach(mention => {
      if (!mention.url) return;
      
      const normalizedTitle = (mention.title || '').toLowerCase()
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
      
      if (!isDuplicate && !uniqueMentions.has(mention.url)) {
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

    const finalMentions = Array.from(uniqueMentions.values())
      .sort((a, b) => (b.credibilityScore || 0) - (a.credibilityScore || 0))
      .slice(0, 10);

    console.log(`Found ${finalMentions.length} press mentions for ${agentName}`);

    // Auto-trigger profile synthesis if professionalId provided
    const shouldSynthesize = professionalId && fullResearchText.trim() && !dryRun;
    const hasPress = finalMentions.length > 0;
    
    if (shouldSynthesize && (!skipIfNoPress || hasPress)) {
      console.log(`🔄 Auto-triggering profile synthesis for ${agentName}...`);
      
      try {
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
      JSON.stringify({ 
        mentions: finalMentions,
        provider: usedFallback ? 'lovable-ai-fallback' : 'claude',
        failoverUsed: usedFallback,
        failoverReason: usedFallback ? failoverError : undefined
      }),
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
