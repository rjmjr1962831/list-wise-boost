import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  website: string | null;
}

export const SynthesisTester = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [synthesis, setSynthesis] = useState<string | null>(null);
  const [websiteUsed, setWebsiteUsed] = useState(false);

  useEffect(() => {
    const fetchAgents = async () => {
      // Fetch 5 Scottsdale agents including Beauvais
      const { data } = await supabase
        .from('professionals')
        .select('id, name, website')
        .eq('zillow_search_city', 'Scottsdale')
        .eq('active', true)
        .gte('review_stars_rating', 4.8)
        .gte('num_total_reviews', 50)
        .order('name')
        .limit(5);

      if (data) {
        // Make sure Beauvais is included
        const beauvais = data.find(a => a.name.toLowerCase().includes('beauvais'));
        if (!beauvais) {
          const { data: beauvaisData } = await supabase
            .from('professionals')
            .select('id, name, website')
            .ilike('name', '%beauvais%')
            .eq('active', true)
            .single();
          
          if (beauvaisData) {
            setAgents([beauvaisData, ...data.slice(0, 4)]);
            return;
          }
        }
        setAgents(data);
      }
    };

    fetchAgents();
  }, []);

  const runSynthesis = async () => {
    if (!selectedAgent) return;

    setIsLoading(true);
    setSynthesis(null);

    try {
      const { data, error } = await supabase.functions.invoke('synthesize-agent-profile', {
        body: { professionalId: selectedAgent }
      });

      if (error) throw error;

      setSynthesis(data?.data?.synthesized_bio || 'No synthesis generated');
      setWebsiteUsed(data?.websiteUsed || false);
    } catch (err) {
      setSynthesis(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedAgentData = agents.find(a => a.id === selectedAgent);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Synthesis Tester (DeepSeek R1)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select an agent" />
            </SelectTrigger>
            <SelectContent>
              {agents.map(agent => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={runSynthesis} disabled={!selectedAgent || isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Run Synthesis
          </Button>
        </div>

        {selectedAgentData?.website && (
          <p className="text-sm text-muted-foreground">
            Website: {selectedAgentData.website}
          </p>
        )}

        {synthesis && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            {websiteUsed && (
              <span className="inline-block mb-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                ✓ Website content used
              </span>
            )}
            <p className="whitespace-pre-line">{synthesis}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
