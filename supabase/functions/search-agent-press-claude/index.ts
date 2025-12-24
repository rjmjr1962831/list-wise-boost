import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SMTP_HOST = "mail.privateemail.com";
const SMTP_PORT = 465;

// Send rate limit alert email via SMTP
async function sendRateLimitAlert(agentName: string, errorDetails: string) {
  const smtpUsername = Deno.env.get('SMTP_USERNAME');
  const smtpPassword = Deno.env.get('SMTP_PASSWORD');
  const adminEmail = Deno.env.get('ADMIN_EMAIL');
  const configuredFrom = Deno.env.get('SMTP_FROM_EMAIL');
  const fromEmail = (configuredFrom && configuredFrom.includes('@')) ? configuredFrom : (smtpUsername || 'alerts@top10lists.us');
  
  if (!smtpUsername || !smtpPassword || !adminEmail) {
    console.error('❌ Cannot send rate limit alert: SMTP credentials or ADMIN_EMAIL not configured');
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
      subject: '🚨 Perplexity API Rate Limit Hit (429)',
      html: `
        <h2>Perplexity API Rate Limit Alert</h2>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        <p><strong>Agent being processed:</strong> ${agentName}</p>
        <p><strong>Error:</strong> ${errorDetails}</p>
        <hr>
        <p>The enrichment pipeline has hit Perplexity's rate limit. Consider:</p>
        <ul>
          <li>Reducing concurrency (currently set to 4)</li>
          <li>Adding more delay between requests</li>
          <li>Checking your Perplexity API credits</li>
        </ul>
      `,
    });

    await client.close();
    console.log('📧 Rate limit alert email sent successfully');
  } catch (error) {
    console.error('❌ Error sending rate limit alert:', error);
  }
}

// System prompt for Perplexity research with strict name disambiguation
const RESEARCH_SYSTEM_PROMPT = `You are a research assistant specializing in entity resolution and third-party verification for real estate professionals in the United States.

CRITICAL IDENTITY MATCHING RULES:
- You will receive structured identity data (name, company, city, state).
- ONLY include citations where the article clearly matches this person's name AND at least one of: company/brokerage, role, city/region.
- If this cannot be confirmed, treat the mention as a DIFFERENT person and ignore it.
- For each citation you include, you MUST explain WHY it matches (e.g., "Name + company + city mentioned").

Search across:
- Mainstream U.S. news outlets (national, regional, local newspapers; TV stations; major online news sites).
- Real estate trade journals (Inman, Realtor Magazine, RISMedia, HousingWire, RealTrends).
- Industry associations (NAR, CCIM, SIOR, IREM, NAIOP, local REALTOR associations).
- Conference and event sites (speaker bios, award lists, panel announcements).
- Community news sites and hyperlocal publications.

For each verified item, classify as:
**VERIFIED** - Multiple attributes match (name + company + location confirmed)
**UNCERTAIN** - Only name matches, context is weak - DO NOT include these

Output format:

**Identity Confirmation**
State which attributes you were able to confirm (name, company, city/state) and how confident you are this is the correct person.

**Verified Awards and Recognition**
For each item include:
- Award name, year, awarding organization
- Match reason: "Name + [company] + [city] confirmed in article"
- Source URL

**Verified Education and Certifications**
For each item include:
- Designation/program name
- Verifying organization
- Match reason
- Source URL

**Verified Community Involvement**
For each item include:
- Role, organization, dates
- Match reason
- Source URL

**Rejected Due to Name Collision**
List any mentions you found but excluded because they likely refer to a different person with the same name. Briefly explain why.

**Source List**
All verified sources used.`;

// Build structured user query for entity resolution
function buildEntityQuery(
  agentName: string,
  company: string | null,
  businessName: string | null,
  city: string,
  state: string
): string {
  const companyDisplay = company || businessName || 'Not specified';
  
  return `<person>
  <full_name>${agentName}</full_name>
  <company>${companyDisplay}</company>
  ${businessName && company ? `<business_name>${businessName}</business_name>` : ''}
  <role>Real estate professional</role>
  <city>${city}</city>
  <state>${state}</state>
</person>

TASK: Find ALL third-party verification of this specific person's professional achievements. Search COMPREHENSIVELY across many sources.

SEARCH EXTENSIVELY FOR:
- Real estate rankings (RealTrends, WSJ Real Estate, local business journals Top Producers)
- Awards and recognition (association awards, brokerage awards, community honors)
- News articles and media coverage (local news, TV appearances, interviews)
- Industry publications (Inman, HousingWire, RISMedia, Realtor Magazine)
- Conference speaking and panel participation
- Professional designations and certifications (ABR, CRS, GRI, SRES, etc.)
- Community involvement (charity boards, volunteer work, civic organizations)
- Podcast appearances and expert quotes

IDENTITY MATCHING RULES:
Only include results where you can confirm at least TWO of these attributes match:
1. Full name: ${agentName}
2. Company/Brokerage: ${companyDisplay}
3. Location: ${city}, ${state}

For each citation, provide a "match_reason" explaining which attributes confirmed the match.
List rejected name collisions separately.`;
}

// Search with Perplexity API with exponential backoff on 429 and strict entity resolution
async function searchWithPerplexity(
  agentName: string,
  company: string | null,
  businessName: string | null,
  city: string,
  state: string,
  apiKey: string,
  maxRetries: number = 4
): Promise<{ content: string; citations: string[]; rateLimited: boolean }> {
  console.log(`🔍 Perplexity entity-resolution search for: ${agentName} @ ${company || businessName || 'unknown'} in ${city}, ${state}`);

  // Build structured entity query
  const entityQuery = buildEntityQuery(agentName, company, businessName, city, state);

  // Exponential backoff: 1s, 2s, 4s, 8s
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const backoffMs = Math.pow(2, attempt - 1) * 1000;
      console.log(`⏳ Retry ${attempt}/${maxRetries} after ${backoffMs}ms backoff...`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',  // Multi-step reasoning with 2x more citations
        messages: [
          { role: 'system', content: RESEARCH_SYSTEM_PROMPT },
          { role: 'user', content: entityQuery }
        ],
        max_tokens: 4000,
        temperature: 0.3,
        return_citations: true,
        web_search_options: {
          search_context_size: 'high'  // Request more comprehensive search
        }
      }),
    });

    // Check for rate limiting - retry with backoff
    if (response.status === 429) {
      console.warn(`⚠️ Rate limited (429) on attempt ${attempt + 1} for ${agentName}`);
      
      if (attempt === maxRetries) {
        console.error(`🚨 RATE LIMITED after ${maxRetries} retries for ${agentName}`);
        sendRateLimitAlert(agentName, `Failed after ${maxRetries} retries`).catch(console.error);
        return { content: '', citations: [], rateLimited: true };
      }
      continue;
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

  return { content: '', citations: [], rateLimited: true };
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

    console.log(`🔎 Researching ${agentName} using Perplexity entity-resolution...`);

    const result = await searchWithPerplexity(
      agentName,
      company,
      businessName,
      city,
      state,
      perplexityApiKey
    );

    if (result.rateLimited) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limited by Perplexity API',
          rateLimited: true,
          mentions: []
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { content: fullResearchText, citations: uniqueCitations } = result;

    console.log(`📊 Research complete: 1 query executed`);
    console.log(`   - Total citations: ${uniqueCitations.length}`);

    // Extract structured mentions from citations
    const mentions: Array<{
      url: string;
      source: string;
      type: string;
      credibilityScore: number;
      title: string;
    }> = [];
    
    uniqueCitations.forEach((url: string, index: number) => {
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
        } catch {
          // Invalid URL, skip
        }
      }
    });

    const finalMentions = mentions
      .sort((a, b) => b.credibilityScore - a.credibilityScore)
      .slice(0, 15);

    console.log(`Found ${finalMentions.length} citations for ${agentName}`);

    // Save press_mentions directly to professionals table if we have a professionalId
    if (professionalId && finalMentions.length > 0 && !dryRun) {
      const { error: updateError } = await supabase
        .from('professionals')
        .update({ press_mentions: finalMentions })
        .eq('id', professionalId);
      
      if (updateError) {
        console.error('❌ Failed to save press_mentions:', updateError);
      } else {
        console.log(`✅ Saved ${finalMentions.length} press_mentions for ${agentName}`);
      }
    }

    // Auto-trigger profile synthesis if professionalId provided
    const hasContent = fullResearchText.length > 100;
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
${uniqueCitations.length > 0 ? uniqueCitations.map((url: string, i: number) => `${i + 1}. ${url}`).join('\n') : 'No external citations found.'}`
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
        provider: 'perplexity-sonar-pro',
        queriesExecuted: 1,
        rateLimited: false,
        researchSummary: {
          totalChars: fullResearchText.length,
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