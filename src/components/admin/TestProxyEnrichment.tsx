import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export function TestProxyEnrichment() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);

  const handleEnrich = async () => {
    setIsRunning(true);
    setProgress(['Starting enrichment test...']);
    
    try {
      // Get 10 qualified Scottsdale agents (excluding George Laughton duplicates)
      const { data: agents, error: fetchError } = await supabase
        .from('professionals')
        .select('id, name, zillow_profile_url')
        .eq('city_id', 'afe374d7-0de5-4574-99bc-1a596df7d995') // Scottsdale
        .eq('category_id', '1384f127-fc2e-4693-9b8f-406451adf3aa') // Real estate
        .gte('review_stars_rating', 4.9)
        .gte('num_total_reviews', 200)
        .neq('name', 'George Laughton')
        .not('zillow_profile_url', 'is', null)
        .limit(10);

      if (fetchError) {
        throw fetchError;
      }

      if (!agents || agents.length === 0) {
        toast.error('No agents found to enrich');
        setProgress(prev => [...prev, '❌ No agents found']);
        return;
      }

      setProgress(prev => [...prev, `Found ${agents.length} agents to enrich`]);

      // Enrich each agent sequentially
      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        setProgress(prev => [...prev, `[${i + 1}/${agents.length}] Enriching ${agent.name}...`]);

        const { data, error } = await supabase.functions.invoke('fetch-single-memo23-agent', {
          body: { 
            professionalId: agent.id,
            profileUrl: agent.zillow_profile_url 
          }
        });

        if (error) {
          setProgress(prev => [...prev, `❌ Failed: ${agent.name} - ${error.message}`]);
        } else {
          const http403 = data?.http403Count || 0;
          const http429 = data?.http429Count || 0;
          const status = http403 > 0 || http429 > 0 
            ? `⚠️ (${http403} 403s, ${http429} 429s)` 
            : '✅';
          setProgress(prev => [...prev, `${status} Completed: ${agent.name}`]);
        }

        // Wait 3 seconds between agents
        if (i < agents.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

      setProgress(prev => [...prev, '✅ Enrichment test complete!']);
      toast.success(`Successfully enriched ${agents.length} agents`);

    } catch (error: any) {
      console.error('Enrichment error:', error);
      setProgress(prev => [...prev, `❌ Error: ${error.message}`]);
      toast.error(error.message || 'Enrichment failed');
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
