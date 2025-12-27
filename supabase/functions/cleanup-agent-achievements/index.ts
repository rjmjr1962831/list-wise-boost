import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';

// Generic profile domains to filter from press_mentions
const genericProfileDomains = [
  'zillow.com', 'realtor.com', 'homes.com', 'redfin.com', 'trulia.com',
  'agentpronto.com', 'homelight.com', 'fastexpert.com', 'ushja.org',
  'archive.sdgcounties.ca', 'data.ushja.org'
];

// Tool schema for Gemini deduplication
const DEDUP_TOOL = {
  type: "function",
  function: {
    name: "deduplicate_content",
    description: "Returns deduplicated arrays of achievements and press mentions",
    parameters: {
      type: "object",
      properties: {
        deduplicated_achievements: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              source: { type: "string" },
              credibility: { type: "number" }
            }
          },
          description: "Deduplicated list of unique achievements (max 8)"
        },
        deduplicated_press: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              source: { type: "string" },
              url: { type: "string" },
              date: { type: "string" }
            }
          },
          description: "Deduplicated list of unique press mentions (max 10)"
        }
      },
      required: ["deduplicated_achievements", "deduplicated_press"]
    }
  }
};

async function callGeminiForDeduplication(
  achievements: any[],
  pressMentions: any[],
  agentName: string
): Promise<{ achievements: any[]; press: any[] }> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    console.log('LOVABLE_API_KEY not found, using fallback deduplication');
    return { 
      achievements: fallbackDedupeAchievements(achievements), 
      press: filterPressMentions(pressMentions) 
    };
  }

  // Pre-filter press mentions to remove generic profile sites
  const filteredPress = filterPressMentions(pressMentions);

  const prompt = `You are deduplicating achievements and press mentions for real estate agent "${agentName}".

ACHIEVEMENTS (${achievements.length} items):
${JSON.stringify(achievements, null, 2)}

PRESS MENTIONS (${filteredPress.length} items after filtering):
${JSON.stringify(filteredPress, null, 2)}

DEDUPLICATION RULES:
1. ACHIEVEMENTS: Keep only semantically unique items. Merge duplicates that say the same thing differently (e.g., "20 years experience" and "Two decades in real estate" are duplicates). Keep the one with higher credibility score. Max 8 achievements.

2. PRESS MENTIONS: Remove duplicates by semantic similarity (same article from different sources = 1 entry). Prefer mentions with actual article titles over generic ones. Max 10 press mentions.

3. Preserve all original field values (title, description, source, url, credibility, date) from the kept items.

Call the deduplicate_content function with the cleaned arrays.`;

  try {
    const response = await fetch(LOVABLE_AI_GATEWAY, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        tools: [DEDUP_TOOL],
        tool_choice: { type: 'function', function: { name: 'deduplicate_content' } },
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API error: ${response.status} - ${errorText}`);
      return { 
        achievements: fallbackDedupeAchievements(achievements), 
        press: filteredPress 
      };
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const args = JSON.parse(toolCall.function.arguments);
      return {
        achievements: args.deduplicated_achievements || fallbackDedupeAchievements(achievements),
        press: args.deduplicated_press || filteredPress
      };
    }

    console.log(`No tool call in Gemini response for ${agentName}, using fallback`);
    return { 
      achievements: fallbackDedupeAchievements(achievements), 
      press: filteredPress 
    };

  } catch (error) {
    console.error(`Gemini deduplication error for ${agentName}:`, error);
    return { 
      achievements: fallbackDedupeAchievements(achievements), 
      press: filterPressMentions(pressMentions) 
    };
  }
}

// Fallback regex-based deduplication
function fallbackDedupeAchievements(achievements: any[]): any[] {
  if (!achievements || !Array.isArray(achievements)) return [];
  
  const semanticCategories: Record<string, RegExp> = {
    'years_experience': /\b(years?|decades?|experience|since \d{4}|career|tenure|practice|long[\s-]term|market presence)\b/i,
    'client_reviews': /\b(reviews?|rating|stars?|satisfaction|client feedback|testimonials?)\b/i,
    'broker_designation': /\b(broker|designated broker|managing broker|principal broker|license|licensing)\b/i,
    'sales_volume': /\b(sales|transactions?|volume|deals?|closed|listings?|sold)\b/i,
    'top_agent_ranking': /\b(top agent|ranked|ranking|#\d|number \d|best agent|premier agent)\b/i,
    'awards': /\b(award|winner|honored|recognition|achievement|excellence)\b/i,
    'certifications': /\b(certified|certification|designation|accreditation|credential|ABR|CRS|GRI|SRES)\b/i,
  };

  const categoryBest: Record<string, any> = {};
  const uncategorized: any[] = [];
  
  for (const achievement of achievements) {
    const title = (achievement.title || '').toLowerCase();
    const description = (achievement.description || '').toLowerCase();
    const combined = `${title} ${description}`;
    
    let matchedCategory: string | null = null;
    for (const [category, pattern] of Object.entries(semanticCategories)) {
      if (pattern.test(combined)) {
        matchedCategory = category;
        break;
      }
    }
    
    if (matchedCategory) {
      const existing = categoryBest[matchedCategory];
      const newCredibility = achievement.credibility || 0;
      if (!existing || newCredibility > (existing.credibility || 0)) {
        categoryBest[matchedCategory] = achievement;
      }
    } else {
      const normalizedTitle = title.replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
      const isDupe = uncategorized.some(a => {
        const existingNorm = (a.title || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
        return existingNorm === normalizedTitle;
      });
      if (!isDupe && normalizedTitle.length > 0) {
        uncategorized.push(achievement);
      }
    }
  }
  
  const merged = [...Object.values(categoryBest), ...uncategorized];
  merged.sort((a: any, b: any) => (b.credibility || 0) - (a.credibility || 0));
  return merged.slice(0, 8);
}

function filterPressMentions(pressMentions: any[]): any[] {
  if (!pressMentions || !Array.isArray(pressMentions)) return [];
  
  return pressMentions.filter((pm: any) => {
    const url = (pm.url || '').toLowerCase();
    const source = (pm.source || '').toLowerCase();
    return !genericProfileDomains.some(domain => url.includes(domain) || source.includes(domain));
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dryRun = false, limit = 100, useGemini = true } = await req.json().catch(() => ({}));
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get synthesized agents with EXCESS achievements (>8) or press (>10)
    const { data: agents, error: fetchError } = await supabase
      .from('professionals')
      .select('id, name, notable_achievements, press_mentions')
      .not('profile_last_synthesized_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (fetchError) throw fetchError;
    
    // Filter to only agents that actually need cleaning
    const agentsNeedingCleanup = (agents || []).filter(a => {
      const achCount = Array.isArray(a.notable_achievements) ? a.notable_achievements.length : 0;
      const pressCount = Array.isArray(a.press_mentions) ? a.press_mentions.length : 0;
      return achCount > 8 || pressCount > 10;
    });
    
    console.log(`Found ${agents?.length || 0} agents, ${agentsNeedingCleanup.length} need cleanup`);

    console.log(`Found ${agents?.length || 0} synthesized agents to process (useGemini: ${useGemini})`);

    const results = {
      processed: 0,
      achievementsReduced: 0,
      pressReduced: 0,
      unchanged: 0,
      errors: 0,
      details: [] as any[]
    };

    for (const agent of agents || []) {
      try {
        const originalAchievements = agent.notable_achievements || [];
        const originalPress = agent.press_mentions || [];
        
        let cleanedAchievements: any[];
        let cleanedPress: any[];
        
        if (useGemini && (originalAchievements.length > 5 || originalPress.length > 5)) {
          // Use Gemini for semantic deduplication on agents with many items
          const deduped = await callGeminiForDeduplication(
            originalAchievements,
            originalPress,
            agent.name
          );
          cleanedAchievements = deduped.achievements;
          cleanedPress = deduped.press;
          
          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          // Use fallback for agents with few items
          cleanedAchievements = fallbackDedupeAchievements(originalAchievements);
          cleanedPress = filterPressMentions(originalPress);
        }
        
        const achievementsDiff = originalAchievements.length - cleanedAchievements.length;
        const pressDiff = originalPress.length - cleanedPress.length;
        
        if (achievementsDiff > 0 || pressDiff > 0) {
          if (!dryRun) {
            const { error: updateError } = await supabase
              .from('professionals')
              .update({
                notable_achievements: cleanedAchievements,
                press_mentions: cleanedPress
              })
              .eq('id', agent.id);
            
            if (updateError) throw updateError;
          }
          
          results.achievementsReduced += achievementsDiff;
          results.pressReduced += pressDiff;
          results.details.push({
            name: agent.name,
            achievements: `${originalAchievements.length} → ${cleanedAchievements.length}`,
            press: `${originalPress.length} → ${cleanedPress.length}`
          });
          
          console.log(`Cleaned ${agent.name}: achievements ${originalAchievements.length} → ${cleanedAchievements.length}, press ${originalPress.length} → ${cleanedPress.length}`);
        } else {
          results.unchanged++;
        }
        
        results.processed++;
      } catch (e) {
        console.error(`Error processing ${agent.name}:`, e);
        results.errors++;
      }
    }

    console.log(`Cleanup complete: ${results.processed} processed, ${results.achievementsReduced} achievements removed, ${results.pressReduced} press removed`);

    return new Response(
      JSON.stringify({
        success: true,
        dryRun,
        useGemini,
        ...results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in cleanup-agent-achievements:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
