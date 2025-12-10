import { useState, useEffect, useRef } from 'react';
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

function ResultCard({ result }: { result: SynthesisResult }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className={`p-3 rounded-lg text-sm ${result.success ? 'bg-green-500/10 border border-green-500/20' : 'bg-destructive/10 border border-destructive/20'}`}>
      <div className="font-medium flex items-center gap-2">
        {result.success ? '✓' : '✗'} {result.agentName}
      </div>
      {result.success && result.synthesized_bio && (
        <div className="mt-1">
          <p 
            className={`text-muted-foreground ${expanded ? '' : 'line-clamp-2'}`}
            dangerouslySetInnerHTML={{ __html: result.synthesized_bio }}
          />
          {result.synthesized_bio.length > 150 && (
            <button 
              onClick={() => setExpanded(!expanded)}
              className="text-primary text-xs mt-1 hover:underline"
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}
      {result.error && (
        <p className="text-destructive mt-1">{result.error}</p>
      )}
    </div>
  );
}

export function SynthesisTester() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [results, setResults] = useState<SynthesisResult[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [stats, setStats] = useState({ success: 0, failed: 0 });
  const stoppedRef = useRef(false);

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
    stoppedRef.current = false;
    setResults([]);
    setProgress({ current: 0, total: agents.length });
    setStats({ success: 0, failed: 0 });

    const BATCH_SIZE = 4; // Run 4 concurrent sessions
    let successCount = 0;
    let failedCount = 0;
    const allResults: SynthesisResult[] = [];

    for (let i = 0; i < agents.length; i += BATCH_SIZE) {
      if (stoppedRef.current) break;

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
    stoppedRef.current = true;
    setRunning(false);
    toast.info('Stopped.');
  };

  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Run ALL Agents (Gemini Search + Claude Synthesis) - {agents.length}</span>
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
        <p className="text-sm text-muted-foreground">
          ⚠️ Runs full synthesis on ALL {agents.length} agents. ~5-8 hours. Use "Bulk Profile Synthesizer" below to select specific agents.
        </p>
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
              <ResultCard key={result.agentId} result={result} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
