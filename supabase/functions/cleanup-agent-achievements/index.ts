import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Semantic categories for deduplication
const semanticCategories: Record<string, RegExp> = {
  'years_experience': /\b(years?|decades?|experience|since \d{4}|career|tenure|practice|long[\s-]term|market presence)\b/i,
  'client_reviews': /\b(reviews?|rating|stars?|satisfaction|client feedback|testimonials?)\b/i,
  'broker_designation': /\b(broker|designated broker|managing broker|principal broker|license|licensing)\b/i,
  'sales_volume': /\b(sales|transactions?|volume|deals?|closed|listings?|sold)\b/i,
  'top_agent_ranking': /\b(top agent|ranked|ranking|#\d|number \d|best agent|premier agent)\b/i,
  'awards': /\b(award|winner|honored|recognition|achievement|excellence)\b/i,
  'certifications': /\b(certified|certification|designation|accreditation|credential|ABR|CRS|GRI|SRES)\b/i,
  'education': /\b(degree|university|college|graduate|valedictorian|scholarship|MBA|bachelor|master)\b/i,
  'community': /\b(community|volunteer|charity|non[\s-]?profit|board member|philanthropic)\b/i,
  'press_media': /\b(featured|press|media|interviewed|quoted|appeared|published|WSJ|Fox|NBC|ABC|CBS)\b/i,
};

// Generic profile domains to filter from press_mentions
const genericProfileDomains = [
  'zillow.com', 'realtor.com', 'homes.com', 'redfin.com', 'trulia.com',
  'agentpronto.com', 'homelight.com', 'fastexpert.com', 'ushja.org',
  'archive.sdgcounties.ca', 'data.ushja.org'
];

function deduplicateAchievements(achievements: any[]): any[] {
  if (!achievements || !Array.isArray(achievements)) return [];
  
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
    const { dryRun = false, limit = 100 } = await req.json().catch(() => ({}));
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all synthesized agents with achievements or press mentions
    const { data: agents, error: fetchError } = await supabase
      .from('professionals')
      .select('id, name, notable_achievements, press_mentions')
      .not('profile_last_synthesized_at', 'is', null)
      .limit(limit);

    if (fetchError) throw fetchError;

    console.log(`Found ${agents?.length || 0} synthesized agents to process`);

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
        
        const cleanedAchievements = deduplicateAchievements(originalAchievements);
        const cleanedPress = filterPressMentions(originalPress);
        
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
