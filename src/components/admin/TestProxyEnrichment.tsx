import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export function TestProxyEnrichment() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [enrichedProfiles, setEnrichedProfiles] = useState<Set<string>>(new Set());

  const handleEnrich = async () => {
    setIsRunning(true);
    setProgress(['Starting enrichment test...']);
    
    try {
      // Get qualified Scottsdale agents
      const { data: allAgents, error: fetchError } = await supabase
        .from('professionals')
        .select('id, name, zillow_profile_url')
        .eq('city_id', 'afe374d7-0de5-4574-99bc-1a596df7d995') // Scottsdale
        .eq('category_id', '1384f127-fc2e-4693-9b8f-406451adf3aa') // Real estate
        .gte('review_stars_rating', 4.9)
        .gte('num_total_reviews', 200)
        .neq('name', 'George Laughton')
        .not('zillow_profile_url', 'is', null)
        .limit(50); // Get more than we need to account for duplicates

      if (fetchError) {
        throw fetchError;
      }

      if (!allAgents || allAgents.length === 0) {
        toast({
          title: "No Agents Found",
          description: "No qualifying agents found to enrich",
          variant: "destructive",
        });
        setProgress(prev => [...prev, '❌ No agents found']);
        return;
      }

      // Deduplicate by zillow_profile_url and exclude already enriched profiles
      const uniqueAgentsMap = new Map<string, typeof allAgents[0]>();
      for (const agent of allAgents) {
        if (agent.zillow_profile_url && 
            !uniqueAgentsMap.has(agent.zillow_profile_url) &&
            !enrichedProfiles.has(agent.zillow_profile_url)) {
          uniqueAgentsMap.set(agent.zillow_profile_url, agent);
        }
      }
      
      const agents = Array.from(uniqueAgentsMap.values()).slice(0, 10);

      if (agents.length === 0) {
        toast({
          title: "All Profiles Already Enriched",
          description: "All available profiles have been enriched in this session",
          variant: "destructive",
        });
        setProgress(prev => [...prev, '⚠️ All available profiles already enriched']);
        return;
      }

      setProgress(prev => [...prev, `Found ${agents.length} unique profiles to enrich (${allAgents.length} total records, ${uniqueAgentsMap.size} unique)`]);
      setProgress(prev => [...prev, `Running ${agents.length} concurrent enrichments...`]);

      // Enrich all agents concurrently
      const enrichmentPromises = agents.map(async (agent, index) => {
        setProgress(prev => [...prev, `[${index + 1}] 🔄 Starting: ${agent.name}`]);

        const startTime = Date.now();
        try {
          const { data, error } = await supabase.functions.invoke('fetch-single-memo23-agent', {
            body: { 
              professionalId: agent.id,
              profileUrl: agent.zillow_profile_url 
            }
          });

          const duration = ((Date.now() - startTime) / 1000).toFixed(1);

          if (error) {
            setProgress(prev => [...prev, `[${index + 1}] ❌ FAILED: ${agent.name} (${duration}s) - ${error.message}`]);
            return { success: false, agent: agent.name, error: error.message, duration };
          } else {
            const http403 = data?.http403Count || 0;
            const http429 = data?.http429Count || 0;
            
            if (http403 > 0 || http429 > 0) {
              setProgress(prev => [...prev, `[${index + 1}] ⚠️ SUCCESS (with errors): ${agent.name} (${duration}s) - ${http403} 403s, ${http429} 429s`]);
              return { success: true, agent: agent.name, profileUrl: agent.zillow_profile_url, http403, http429, duration, hasWarnings: true };
            } else {
              setProgress(prev => [...prev, `[${index + 1}] ✅ SUCCESS: ${agent.name} (${duration}s)`]);
              return { success: true, agent: agent.name, profileUrl: agent.zillow_profile_url, http403: 0, http429: 0, duration, hasWarnings: false };
            }
          }
        } catch (err: any) {
          const duration = ((Date.now() - startTime) / 1000).toFixed(1);
          setProgress(prev => [...prev, `[${index + 1}] ❌ FAILED: ${agent.name} (${duration}s) - ${err.message || 'Unknown error'}`]);
          return { success: false, agent: agent.name, error: err.message || 'Unknown error', duration };
        }
      });

      const results = await Promise.all(enrichmentPromises);
      
      // Mark enriched profiles
      const newlyEnrichedProfiles = new Set(enrichedProfiles);
      results.forEach(result => {
        if (result.success && result.profileUrl) {
          newlyEnrichedProfiles.add(result.profileUrl);
        }
      });
      setEnrichedProfiles(newlyEnrichedProfiles);
      
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      const warningCount = results.filter(r => r.success && r.hasWarnings).length;
      const total403s = results.reduce((sum, r) => sum + (r.http403 || 0), 0);
      const total429s = results.reduce((sum, r) => sum + (r.http429 || 0), 0);
      const avgDuration = (results.reduce((sum, r) => sum + parseFloat(r.duration || '0'), 0) / results.length).toFixed(1);

      setProgress(prev => [...prev, `\n${'='.repeat(60)}`]);
      setProgress(prev => [...prev, `📊 ENRICHMENT COMPLETE`]);
      setProgress(prev => [...prev, `${'='.repeat(60)}`]);
      setProgress(prev => [...prev, `✅ Successful: ${successCount}/${agents.length}`]);
      if (failCount > 0) {
        setProgress(prev => [...prev, `❌ Failed: ${failCount}/${agents.length}`]);
      }
      if (warningCount > 0) {
        setProgress(prev => [...prev, `⚠️ With warnings: ${warningCount}/${agents.length}`]);
      }
      if (total403s > 0 || total429s > 0) {
        setProgress(prev => [...prev, `🚫 HTTP Errors: ${total403s} 403s, ${total429s} 429s`]);
      }
      setProgress(prev => [...prev, `⏱️ Average duration: ${avgDuration}s per agent`]);
      setProgress(prev => [...prev, `📋 Total enriched this session: ${newlyEnrichedProfiles.size} unique profiles`]);
      setProgress(prev => [...prev, `${'='.repeat(60)}`]);
      
      if (failCount === 0) {
        toast({
          title: "Enrichment Complete",
          description: `Successfully enriched all ${successCount} agents${warningCount > 0 ? ` (${warningCount} with warnings)` : ''}`,
        });
      } else {
        toast({
          title: "Enrichment Complete with Errors",
          description: `${successCount} succeeded, ${failCount} failed`,
          variant: "destructive",
        });
      }

    } catch (error: any) {
      console.error('Enrichment error:', error);
      setProgress(prev => [...prev, `\n❌ FATAL ERROR: ${error.message}`]);
      toast({
        title: "Enrichment Failed",
        description: error.message || 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Rotating Proxy Enrichment</CardTitle>
        <CardDescription>
          Enrich 10 qualified Scottsdale agents using the new rotating proxy setup
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handleEnrich} 
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enriching...
            </>
          ) : (
            'Start Enrichment Test'
          )}
        </Button>

        {progress.length > 0 && (
          <div className="mt-4 p-4 bg-muted rounded-lg space-y-2 max-h-96 overflow-y-auto">
            {progress.map((msg, i) => (
              <div key={i} className="text-sm font-mono">
                {msg}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
