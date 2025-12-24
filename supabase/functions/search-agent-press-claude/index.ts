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
  // Use SMTP_USERNAME as from email if SMTP_FROM_EMAIL is not set or invalid
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
          <li>Reducing concurrency (currently set to 5)</li>
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

// System prompt for Perplexity research
const RESEARCH_SYSTEM_PROMPT = `You are a research assistant whose job is to find independent, third-party verification of a real estate professional's reputation and activities in the United States.

Perform the widest-possible press and web search across:

- Mainstream U.S. news outlets (national, regional, and local newspapers; TV stations; major online news sites).
- Real estate trade journals and magazines (e.g., Inman, Realtor Magazine, RISMedia, HousingWire, National Real Estate Investor, RealTrends, Multi-Housing News).
- Industry association and designation sites (e.g., NAR, CCIM, SIOR, IREM, NAIOP, local REALTOR associations, state real estate commissions).
- Real estate–focused blogs, community news sites, and hyperlocal publications.
- Conference and event sites (speaker bios, award lists, panel announcements).

Goal: Identify credible third-party sources that confirm the following for the specified professional:

**Awards and professional recognition**
- Industry awards, "Top Producer" lists, "40 Under 40," "Top Agent," volume/ranking awards, brokerage or franchise awards.
- Any community or civic awards connected to real estate work.

**Special education, training, and certifications**
- Advanced or specialty designations (e.g., CRS, GRI, CCIM, SIOR, CPM, SRES, ABR, CLHMS, commercial/land/specialty certifications).
- Graduate degrees or formal programs related to real estate, finance, urban planning, law, or business, when mentioned by third-party sources.

**Community involvement and service**
- Volunteer roles, board memberships, and leadership in local nonprofits, chambers of commerce, neighborhood associations, housing or affordability initiatives.
- Fundraisers, charity events, school or youth programs, housing-related community projects, or other civic engagement that is documented by external organizations.

Important rules:
- Focus on third-party verification only (news outlets, associations, event organizers, independent blogs). Do not rely on self-authored bios or marketing pages unless they are hosted and endorsed by a reputable third-party organization.
- When possible, prefer sources that clearly identify the person with matching name + company + city/region and are dated.
- If there is risk of confusing this person with someone else who has the same name, explicitly call that out and only include items where the affiliation/location clearly match.

Output format:

**Summary** (2–4 sentences)
Briefly describe how well the person is covered in the press and industry outlets, and whether there is strong or limited third-party verification.

**Verified awards and recognition**
Bullet list of each award or recognition. For each item, include: award name, year (if available), awarding organization, and the exact phrasing used in the source if notable. Include the source name and URL in parentheses.

**Verified education, training, and certifications**
Bullet list of each designation or program that is confirmed by a third-party source. Specify the designation acronym, its full name, and the verifying organization or page, with URL.

**Verified community involvement**
Bullet list of community, nonprofit, civic, or housing-related activities that are confirmed by third-party sources. Include role (e.g., board member, volunteer, sponsor), organization, location, and any available dates, with source and URL.

**Name-collision or ambiguity notes**
If there are multiple people with the same name, briefly explain how you distinguished the subject (e.g., matching brokerage, city, or credentials). If you cannot confidently attribute a mention, list it under a separate "Possibly unrelated mentions" subsection and clearly mark it as uncertain.

**Source list**
A final bullet list of all distinct sources used (publication or site name only) so it is easy to see the diversity of outlets.

Use clear, professional language and keep the structure consistent.`;

// Search with Perplexity API with exponential backoff on 429
async function searchWithPerplexity(
  agentName: string,
  company: string | null,
  businessName: string | null,
  city: string,
  state: string,
  apiKey: string,
  maxRetries: number = 4
): Promise<{ content: string; citations: string[]; rateLimited: boolean }> {
  console.log(`🔍 Perplexity sonar-pro search for: ${agentName}`);
  
  // Build the user query with agent details
  const userQuery = `Research the following real estate professional:

**Full Name:** ${agentName}
**Company/Brokerage:** ${company || businessName || 'Not specified'}
${businessName && company ? `**Business Name:** ${businessName}` : ''}
**Location:** ${city}, ${state}

Find all third-party verification of their awards, certifications, community involvement, and press mentions.`;

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
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: RESEARCH_SYSTEM_PROMPT },
          { role: 'user', content: userQuery }
        ],
        max_tokens: 2000,
        temperature: 0.2
      }),
    });

    // Check for rate limiting - retry with backoff
    if (response.status === 429) {
      console.warn(`⚠️ Rate limited (429) on attempt ${attempt + 1} for ${agentName}`);
      
      if (attempt === maxRetries) {
        console.error(`🚨 RATE LIMITED after ${maxRetries} retries for ${agentName}`);
        // Only send alert on final failure
        sendRateLimitAlert(agentName, `Failed after ${maxRetries} retries`).catch(console.error);
        return { content: '', citations: [], rateLimited: true };
      }
      // Continue to next retry iteration
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

  // Should not reach here, but safety fallback
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

    console.log(`🔎 Researching ${agentName} using Perplexity sonar-pro (single comprehensive query)...`);

    // Execute single comprehensive search
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
