import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Send rate limit alert email
async function sendRateLimitAlert(agentName: string, errorDetails: string) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const adminEmail = Deno.env.get('ADMIN_EMAIL');
  
  if (!resendApiKey || !adminEmail) {
    console.error('❌ Cannot send rate limit alert: RESEND_API_KEY or ADMIN_EMAIL not configured');
    return;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Top10Lists <alerts@top10lists.us>',
        to: [adminEmail],
        subject: '🚨 Perplexity API Rate Limit Hit (429)',
        html: `
          <h2>Perplexity API Rate Limit Alert</h2>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          <p><strong>Agent being processed:</strong> ${agentName}</p>
          <p><strong>Error:</strong> ${errorDetails}</p>
          <hr>
          <p>The enrichment pipeline has hit Perplexity's rate limit. Consider:</p>
          <ul>
            <li>Reducing concurrency (currently set to 5)</li>
            <li>Adding more delay between requests</li>
            <li>Checking your Perplexity API credits</li>
          </ul>
        `,
      }),
    });

    if (response.ok) {
      console.log('📧 Rate limit alert email sent successfully');
    } else {
      const errorText = await response.text();
      console.error('❌ Failed to send rate limit alert:', errorText);
    }
  } catch (error) {
    console.error('❌ Error sending rate limit alert:', error);
  }
}

// Search with Perplexity API
async function searchWithPerplexity(
  query: string, 
  apiKey: string, 
  agentName: string
): Promise<{ content: string; citations: string[]; rateLimited: boolean }> {
  console.log(`🔍 Perplexity search: ${query.substring(0, 80)}...`);
  
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        { 
          role: 'system', 
          content: `You are a research assistant finding credible press mentions and community involvement for real estate professionals.
Return factual information with specific details like publication names, dates, organizations, and achievements.
Focus on verifiable facts from credible sources like news outlets, industry publications, and nonprofit organizations.
If you cannot find specific information, say so clearly.` 
        },
        { role: 'user', content: query }
      ],
      max_tokens: 1000,
      temperature: 0.3
    }),
  });

  // Check for rate limiting
  if (response.status === 429) {
    const errorText = await response.text();
    console.error(`🚨 RATE LIMITED (429) while searching for ${agentName}`);
    
    // Send alert email (fire-and-forget)
    sendRateLimitAlert(agentName, `Status 429: ${errorText}`).catch(console.error);
    
    return { content: '', citations: [], rateLimited: true };
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Perplexity API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const citations = data.citations || [];
  
  console.log(`✅ Perplexity returned ${content.length} chars, ${citations.length} citations`);
  
  return { content, citations, rateLimited: false };
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
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!perplexityApiKey) {
      throw new Error('PERPLEXITY_API_KEY not configured');
    }

    console.log(`🔎 Researching ${agentName} using Perplexity (5 queries max)...`);

    const agentIdentifier = `${agentName}${businessName ? ` (${businessName})` : ''}${company ? ` at ${company}` : ''}, real estate agent in ${city}, ${state}`;

    // 5 targeted search queries (reduced from original)
    const searchQueries = [
      // 1. Press & Media
      `Find news articles, TV appearances, and media coverage for ${agentIdentifier}. 
Look for: local news features, Wall Street Journal mentions, Fox/NBC/ABC coverage, podcast appearances.`,

      // 2. Industry Awards
      `Find industry awards and recognitions for ${agentIdentifier}.
Look for: Real Trends rankings, America's Best Real Estate Agents, Five Star Professional, local realtor association awards.`,

      // 3. Community & Nonprofit
      `Find community involvement and nonprofit work for ${agentIdentifier}.
Look for: charity work, board memberships, Habitat for Humanity, food banks, youth coaching, scholarship funds.`,

      // 4. Professional Organizations
      `Find professional memberships and leadership roles for ${agentIdentifier}.
Look for: Rotary, Kiwanis, chamber of commerce, NAR leadership, state/local realtor association roles.`,

      // 5. Publications & Speaking
      `Find articles written by, speaking engagements, or educational content from ${agentIdentifier}.
Look for: authored articles in Inman/HousingWire, conference presentations, webinars, real estate training.`
    ];

    let rateLimitHit = false;
    const allResults: { content: string; citations: string[] }[] = [];

    // Execute searches sequentially with delay to avoid rate limits
    for (let i = 0; i < searchQueries.length; i++) {
      if (rateLimitHit) {
        console.log(`⏸️ Stopping further queries due to rate limit`);
        break;
      }

      try {
        // Delay between requests (except first)
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }
        
        const result = await searchWithPerplexity(searchQueries[i], perplexityApiKey, agentName);
        
        if (result.rateLimited) {
          rateLimitHit = true;
          break;
        }
        
        allResults.push({ content: result.content, citations: result.citations });
      } catch (error) {
        console.error(`❌ Search ${i + 1} failed:`, error);
        allResults.push({ content: '', citations: [] });
      }
    }

    // Combine results
    const allCitations = allResults.flatMap(r => r.citations);
    const uniqueCitations = [...new Set(allCitations)];

    const fullResearchText = allResults.map((r, i) => {
      const labels = ['PRESS & MEDIA', 'INDUSTRY AWARDS', 'COMMUNITY & NONPROFIT', 'PROFESSIONAL ORGS', 'PUBLICATIONS & SPEAKING'];
      return `# ${labels[i] || `SEARCH ${i + 1}`}\n${r.content || 'No results found.'}`;
    }).join('\n\n');

    console.log(`📊 Research complete: ${allResults.length} queries executed`);
    console.log(`   - Total citations: ${uniqueCitations.length}`);
    console.log(`   - Rate limited: ${rateLimitHit}`);

    // Extract structured mentions from citations
    const mentions: any[] = [];
    
    uniqueCitations.forEach((url, index) => {
      if (url && typeof url === 'string') {
        try {
          const lowerUrl = url.toLowerCase();
          let type = 'article';
          let credibilityScore = 5;
          
          if (lowerUrl.includes('wsj.com') || lowerUrl.includes('wallstreetjournal')) {
            type = 'award';
            credibilityScore = 10;
          } else if (lowerUrl.includes('fox') || lowerUrl.includes('nbc') || lowerUrl.includes('abc') || lowerUrl.includes('cbs')) {
            type = 'tv_appearance';
            credibilityScore = 9;
          } else if (lowerUrl.includes('inman') || lowerUrl.includes('housingwire') || lowerUrl.includes('realproducer')) {
            type = 'article';
            credibilityScore = 8;
          } else if (lowerUrl.includes('habitat') || lowerUrl.includes('rotary') || lowerUrl.includes('kiwanis') || lowerUrl.includes('charity')) {
            type = 'community';
            credibilityScore = 7;
          } else if (lowerUrl.includes('podcast') || lowerUrl.includes('spotify') || lowerUrl.includes('apple.com/podcast')) {
            type = 'podcast';
            credibilityScore = 7;
          }
          
          mentions.push({
            url,
            source: new URL(url).hostname.replace('www.', ''),
            type,
            credibilityScore,
            title: `Source ${index + 1}`
          });
        } catch (e) {
          // Invalid URL, skip
        }
      }
    });

    const finalMentions = mentions
      .sort((a, b) => b.credibilityScore - a.credibilityScore)
      .slice(0, 15);

    console.log(`Found ${finalMentions.length} citations for ${agentName}`);

    // Auto-trigger profile synthesis if professionalId provided
    const hasContent = allResults.some(r => r.content.length > 50);
    const shouldSynthesize = professionalId && fullResearchText.trim() && !dryRun;
    
    let synthesisResult = null;
    let synthesisError = null;
    
    if (shouldSynthesize && (!skipIfNoPress || hasContent)) {
      console.log(`🔄 Auto-triggering profile synthesis for ${agentName}...`);
      
      try {
        const { data: synthData, error: synthErr } = await supabase.functions.invoke('synthesize-agent-profile', {
          body: {
            professionalId,
            skipIfNoPress: false,
            rawResearch: `# Perplexity Research for ${agentName}

## Context
Agent: ${agentName}
${company ? `Company: ${company}` : ''}
${businessName ? `Business: ${businessName}` : ''}
Location: ${city}, ${state}

${fullResearchText}

# SOURCE CITATIONS
${uniqueCitations.length > 0 ? uniqueCitations.map((url, i) => `${i + 1}. ${url}`).join('\n') : 'No external citations found.'}`
          }
        });
        
        if (synthErr) {
          console.error('❌ Profile synthesis failed:', synthErr);
          synthesisError = synthErr.message || 'Synthesis failed';
        } else {
          console.log('✅ Profile synthesis completed successfully');
          synthesisResult = synthData;
        }
      } catch (synthError) {
        console.error('❌ Failed to trigger synthesis:', synthError);
        synthesisError = synthError instanceof Error ? synthError.message : 'Unknown synthesis error';
      }
    }

    return new Response(
      JSON.stringify({ 
        mentions: finalMentions,
        provider: 'perplexity',
        queriesExecuted: allResults.length,
        rateLimited: rateLimitHit,
        researchSummary: {
          totalChars: allResults.reduce((sum, r) => sum + r.content.length, 0),
          totalCitations: uniqueCitations.length
        },
        synthesis: {
          triggered: shouldSynthesize && (!skipIfNoPress || hasContent),
          success: !!synthesisResult && !synthesisError,
          error: synthesisError
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-agent-press:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
