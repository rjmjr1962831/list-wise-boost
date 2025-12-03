import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Loader2, Play, Square } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
}

interface SynthesisResult {
  agentId: string;
  agentName: string;
  success: boolean;
  synthesized_bio?: string;
  error?: string;
}

export function SynthesisTester() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [results, setResults] = useState<SynthesisResult[]>([]);
  const [running, setRunning] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [stats, setStats] = useState({ success: 0, failed: 0 });

  useEffect(() => {
    fetchAllActiveAgents();
  }, []);

  const fetchAllActiveAgents = async () => {
    const { data, error } = await supabase
      .from('professionals')
      .select('id, name')
      .eq('active', true)
      .order('name', { ascending: true });

    if (error) {
      toast.error('Failed to fetch agents');
      return;
    }
    setAgents(data || []);
  };

  const runAllSynthesis = async () => {
    if (agents.length === 0) {
      toast.error('No agents loaded');
      return;
    }

    setRunning(true);
    setStopped(false);
    setResults([]);
    setProgress({ current: 0, total: agents.length });
    setStats({ success: 0, failed: 0 });

    const BATCH_SIZE = 1; // Run 1 at a time to avoid 503 boot errors
    let successCount = 0;
    let failedCount = 0;
    const allResults: SynthesisResult[] = [];

    for (let i = 0; i < agents.length; i += BATCH_SIZE) {
      if (stopped) break;

      const batch = agents.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (agent) => {
        try {
          const { data, error } = await supabase.functions.invoke('synthesize-agent-profile', {
            body: { professionalId: agent.id }
          });

          if (error) throw error;
          
          return {
            agentId: agent.id,
            agentName: agent.name,
            success: true,
            synthesized_bio: data?.data?.synthesized_bio
          };
        } catch (err: any) {
          return {
            agentId: agent.id,
            agentName: agent.name,
            success: false,
            error: err.message || 'Failed'
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      for (const result of batchResults) {
        allResults.push(result);
        if (result.success) successCount++;
        else failedCount++;
      }

      setResults([...allResults]);
      setProgress({ current: Math.min(i + BATCH_SIZE, agents.length), total: agents.length });
      setStats({ success: successCount, failed: failedCount });
    }

    setRunning(false);
    toast.success(`Synthesis complete: ${successCount} success, ${failedCount} failed`);
  };

  const stopSynthesis = () => {
    setStopped(true);
    toast.info('Stopping after current batch...');
  };

  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Bulk Synthesis (Claude Sonnet) - {agents.length} Agents</span>
          <div className="flex gap-2">
            {!running ? (
              <Button onClick={runAllSynthesis} disabled={agents.length === 0}>
                <Play className="w-4 h-4 mr-2" /> Run All {agents.length}
              </Button>
            ) : (
              <Button variant="destructive" onClick={stopSynthesis}>
                <Square className="w-4 h-4 mr-2" /> Stop
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {running && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress: {progress.current} / {progress.total}</span>
              <span className="text-muted-foreground">
                ✓ {stats.success} | ✗ {stats.failed}
              </span>
            </div>
            <Progress value={progressPercent} />
          </div>
        )}

        {!running && results.length > 0 && (
          <div className="text-sm font-medium">
            Completed: {stats.success} success, {stats.failed} failed
          </div>
        )}

        {results.length > 0 && (
          <div className="max-h-[500px] overflow-y-auto space-y-2">
            {results.map((result) => (
              <div 
                key={result.agentId} 
                className={`p-3 rounded-lg text-sm ${result.success ? 'bg-green-500/10 border border-green-500/20' : 'bg-destructive/10 border border-destructive/20'}`}
              >
                <div className="font-medium flex items-center gap-2">
                  {result.success ? '✓' : '✗'} {result.agentName}
                </div>
                {result.success && result.synthesized_bio && (
                  <p className="text-muted-foreground mt-1 line-clamp-2">{result.synthesized_bio}</p>
                )}
                {result.error && (
                  <p className="text-destructive mt-1">{result.error}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
