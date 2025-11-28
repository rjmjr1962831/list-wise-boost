import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agentName, company, businessName, city, state } = await req.json();
    
    if (!agentName) {
      return new Response(JSON.stringify({ error: 'Agent name is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    if (!PERPLEXITY_API_KEY) {
      throw new Error('PERPLEXITY_API_KEY not configured');
    }

    console.log(`🔍 Multi-query press search for: ${agentName} (${company || 'N/A'}) in ${city}, ${state}`);

    // Credible press domains for scoring
    const crediblePressDomains = [
      'wsj.com', 'nytimes.com', 'bloomberg.com', 'reuters.com', 'forbes.com',
      'azcentral.com', 'bizjournals.com', 'phoenixbusinessjournal.com',
      'inman.com', 'realtrends.com', 'housingwire.com', 'nar.realtor',
      'abc15.com', 'fox10phoenix.com', '12news.com', 'ktar.com',
      'news.google.com', 'news.yahoo.com', 'apnews.com'
    ];

    // Build company context string for queries
    const companyContext = company || businessName || '';

    // Create 6 targeted search queries
    const searchQueries = [
      // 1. Major national publications
      `"${agentName}" ${companyContext ? `"${companyContext}"` : ''} "Wall Street Journal" OR "WSJ" OR "New York Times" OR "Bloomberg" OR "Reuters" OR "Forbes" Arizona real estate`,
      
      // 2. Industry publications
      `"${agentName}" ${companyContext ? `"${companyContext}"` : ''} "Real Trends" OR "Inman" OR "HousingWire" OR "National Association of Realtors" Arizona realtor`,
      
      // 3. Local/regional Arizona media
      `"${agentName}" ${companyContext ? `"${companyContext}"` : ''} "Phoenix Business Journal" OR "azcentral" OR "Arizona Republic" ${city}`,
      
      // 4. Google News aggregator
      `"${agentName}" ${companyContext ? `"${companyContext}"` : ''} Arizona real estate agent site:news.google.com`,
      
      // 5. Awards and rankings
      `"${agentName}" ${companyContext ? `"${companyContext}"` : ''} "top agent" OR "best realtor" OR "award" OR "ranking" Arizona Phoenix ${city}`,
      
      // 6. Broad press/interview search
      `"${agentName}" real estate agent Arizona interview OR featured OR quoted OR spotlight news`
    ];

    console.log(`🎯 Running ${searchQueries.length} parallel searches...`);

    // Excluded domains (denylist mode)
    const excludedDomainsFilter = [
      '-zillow.com', '-realtor.com', '-redfin.com', '-trulia.com',
      '-homes.com', '-facebook.com', '-linkedin.com', '-instagram.com',
      '-twitter.com', '-x.com', '-yelp.com', '-compass.com',
      '-coldwellbanker.com', '-century21.com', '-remax.com', '-kw.com'
    ];

    // Function to call Perplexity with a specific query
    const searchWithQuery = async (query: string, index: number) => {
      console.log(`🔍 Query ${index + 1}: ${query}`);
      
      try {
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'sonar-pro',
            messages: [
              {
                role: 'system',
                content: 'You are a research assistant that finds press mentions. Return only valid JSON arrays with title, source, url, snippet, date fields. No markdown.'
              },
              {
                role: 'user',
                content: `Find press mentions matching: ${query}\n\nReturn JSON array format: [{"title":"...","source":"domain.com","url":"https://...","snippet":"...","date":"YYYY-MM-DD"}]\nIf none found, return: []`
              }
            ],
            temperature: 0.2,
            top_p: 0.9,
            max_tokens: 1500,
            return_images: false,
            return_related_questions: false,
            search_domain_filter: excludedDomainsFilter
          }),
        });

        if (!response.ok) {
          console.error(`❌ Query ${index + 1} failed:`, response.status);
          return [];
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        const citations = data.citations || [];

        console.log(`📊 Query ${index + 1} citations:`, citations);

        // Try parsing content as JSON
        let mentions = [];
        if (content) {
          try {
            let jsonStr = content.trim();
            if (jsonStr.startsWith('```')) {
              const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
              if (match) jsonStr = match[1].trim();
            }
            mentions = JSON.parse(jsonStr);
            if (!Array.isArray(mentions)) mentions = [];
          } catch {
            console.log(`⚠️ Query ${index + 1} - Could not parse as JSON`);
          }
        }

        // Also extract from citations array
        citations.forEach((url: string) => {
          try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase().replace('www.', '');
            
            // Check if it's a credible press domain
            if (crediblePressDomains.some(domain => hostname.includes(domain))) {
              mentions.push({
                title: `Press mention from ${hostname}`,
                source: hostname,
                url: url,
                snippet: '',
                date: new Date().toISOString().split('T')[0]
              });
            }
          } catch {
            // Invalid URL, skip
          }
        });

        console.log(`✅ Query ${index + 1} found ${mentions.length} results`);
        return mentions;

      } catch (error) {
        console.error(`❌ Query ${index + 1} error:`, error);
        return [];
      }
    };

    // Run all searches in parallel
    const allResults = await Promise.allSettled(
      searchQueries.map((query, index) => searchWithQuery(query, index))
    );

    // Merge all results
    let allMentions: any[] = [];
    allResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allMentions = allMentions.concat(result.value);
        console.log(`📦 Merged ${result.value.length} from query ${index + 1}`);
      }
    });

    console.log(`📊 Total mentions before deduplication: ${allMentions.length}`);

    // Deduplicate by URL and validate
    const excludedDomains = [
      'zillow.com', 'realtor.com', 'facebook.com', 'linkedin.com',
      'instagram.com', 'twitter.com', 'x.com', 'yelp.com', 'redfin.com',
      'homes.com', 'trulia.com', 'compass.com', 'coldwellbanker.com',
      'century21.com', 'remax.com', 'kw.com'
    ];

    const seenUrls = new Set<string>();
    const validatedMentions = allMentions
      .filter((mention: any) => {
        if (!mention.url || !mention.title) return false;
        if (seenUrls.has(mention.url)) return false;

        try {
          const url = new URL(mention.url);
          const hostname = url.hostname.toLowerCase();
          
          if (excludedDomains.some(domain => hostname.includes(domain))) {
            return false;
          }
          
          seenUrls.add(mention.url);
          return true;
        } catch {
          return false;
        }
      })
      .map((mention: any) => {
        try {
          const hostname = new URL(mention.url).hostname.replace('www.', '');
          const isCredible = crediblePressDomains.some(domain => hostname.includes(domain));
          
          return {
            title: mention.title,
            source: mention.source || hostname,
            url: mention.url,
            snippet: mention.snippet || '',
            date: mention.date || new Date().toISOString().split('T')[0],
            credibilityScore: isCredible ? 10 : 5
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.credibilityScore - a.credibilityScore)
      .slice(0, 10) // Top 10 mentions
      .map(({ credibilityScore, ...rest }: any) => rest); // Remove score from output

    console.log(`✅ Found ${validatedMentions.length} unique validated press mentions`);
    validatedMentions.forEach((m: any) => console.log(`   - ${m.source}: ${m.title}`));

    return new Response(JSON.stringify({ mentions: validatedMentions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in search-agent-press:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      mentions: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
