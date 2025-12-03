import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  website: string | null;
}

interface SynthesisResult {
  agentId: string;
  agentName: string;
  loading: boolean;
  data?: any;
  error?: string;
}

export function SynthesisTester() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [results, setResults] = useState<SynthesisResult[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetchScottsdaleAgents();
  }, []);

  const fetchScottsdaleAgents = async () => {
    // First get Beauvais
    const { data: beauvais } = await supabase
      .from('professionals')
      .select('id, name, website')
      .ilike('name', '%beauvais%')
      .eq('active', true)
      .single();

    // Then get other Scottsdale agents
    const { data: others } = await supabase
      .from('professionals')
      .select('id, name, website')
      .eq('zillow_search_city', 'Scottsdale')
      .eq('active', true)
      .order('name', { ascending: true })
      .limit(10);

    const combined: Agent[] = [];
    if (beauvais) combined.push(beauvais);
    if (others) {
      for (const agent of others) {
        if (!combined.find(a => a.id === agent.id)) {
          combined.push(agent);
        }
        if (combined.length >= 5) break;
      }
    }
    setAgents(combined);
  };

  const runAllSynthesis = async () => {
    if (agents.length === 0) {
      toast.error('No agents loaded');
      return;
    }

    setRunning(true);
    
    // Initialize results with loading state
    const initialResults: SynthesisResult[] = agents.map(agent => ({
      agentId: agent.id,
      agentName: agent.name,
      loading: true
    }));
    setResults(initialResults);

    // Run all 5 in parallel
    const promises = agents.map(async (agent) => {
      try {
        const { data, error } = await supabase.functions.invoke('synthesize-agent-profile', {
          body: { professionalId: agent.id }
        });

        if (error) throw error;
        
        return {
          agentId: agent.id,
          agentName: agent.name,
          loading: false,
          data
        };
      } catch (err: any) {
        return {
          agentId: agent.id,
          agentName: agent.name,
          loading: false,
          error: err.message || 'Failed'
        };
      }
    });

    const allResults = await Promise.all(promises);
    setResults(allResults);
    setRunning(false);
    toast.success('All synthesis complete');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Synthesis Tester (Claude Sonnet) - 5 Scottsdale Agents</span>
          <Button onClick={runAllSynthesis} disabled={running || agents.length === 0}>
            {running ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Running All...</> : 'Run All 5'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground mb-4">
          Agents: {agents.map(a => a.name).join(', ') || 'Loading...'}
        </div>

        {results.length > 0 && (
          <div className="space-y-4">
            {results.map((result) => (
              <div key={result.agentId} className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  {result.agentName}
                  {result.loading && <Loader2 className="w-4 h-4 animate-spin" />}
                </h4>
                
                {result.error && (
                  <p className="text-destructive">{result.error}</p>
                )}
                
                {result.data && (
                  <>
                    <p className="whitespace-pre-line text-sm">{result.data.data?.synthesized_bio || 'No bio generated'}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Website: {result.data.websiteUsed ? 'Yes' : 'No'} | 
                      Achievements: {result.data.data?.notable_achievements?.length || 0}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
