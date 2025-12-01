import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AgentJob {
  id: string;
  name: string;
  city: string;
  status: 'pending' | 'running' | 'success' | 'error';
  mentionsFound?: number;
  message?: string;
}

export default function BulkPressEnricher() {
  const [isRunning, setIsRunning] = useState(false);
  const [jobs, setJobs] = useState<AgentJob[]>([]);
  const [progress, setProgress] = useState(0);
  const [shouldStop, setShouldStop] = useState(false);
  const [batchSize, setBatchSize] = useState(3);
  const [batchDelay, setBatchDelay] = useState(12);
  const [maxAgents, setMaxAgents] = useState(50);

  const runBulkEnrichment = async () => {
    setIsRunning(true);
    setJobs([]);
    setProgress(0);
    setShouldStop(false);

    try {
      // Get real estate category
      const { data: category } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', 'top10realestateagents')
        .single();

      if (!category) {
        toast.error('Failed to find real estate category');
        return;
      }

      // Fetch all active agents, limited by maxAgents
      const { data: agents, error } = await supabase
        .from('professionals')
        .select(`
          id, 
          name, 
          company, 
          business_name, 
          press_mentions,
          cities!inner(name, state, slug)
        `)
        .eq('category_id', category.id)
        .eq('active', true)
        .order('rank')
        .limit(maxAgents);

      if (error || !agents || agents.length === 0) {
        toast.error('No agents found');
        return;
      }

      console.log(`Found ${agents.length} agents to enrich`);

      // Initialize jobs
      const initialJobs: AgentJob[] = agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        city: (agent.cities as any).name,
        status: 'pending'
      }));
      setJobs(initialJobs);

      let completedCount = 0;

      // Helper function to process a single agent
      const processAgent = async (agent: typeof agents[0]) => {
        setJobs(prev => prev.map(j => 
          j.id === agent.id ? { ...j, status: 'running' } : j
        ));

        try {
          let retryCount = 0;
          const maxRetries = 3;
          let pressData = null;

          while (retryCount <= maxRetries) {
            const { data, error: pressError } = await supabase.functions.invoke('search-agent-press-claude', {
              body: {
                agentName: agent.name,
                company: agent.company,
                businessName: agent.business_name,
                city: (agent.cities as any).name,
                state: (agent.cities as any).state,
                professionalId: agent.id
              }
            });

            if (pressError) {
              const errorMessage = pressError.message || '';
              if (errorMessage.includes('429') || errorMessage.includes('Rate limited') || errorMessage.includes('rate_limit')) {
                retryCount++;
                if (retryCount <= maxRetries) {
                  const waitTime = 30000 * retryCount;
                  console.log(`Rate limited on ${agent.name}, waiting ${waitTime/1000}s before retry ${retryCount}/${maxRetries}...`);
                  setJobs(prev => prev.map(j => 
                    j.id === agent.id 
                      ? { ...j, message: `Rate limited, retrying in ${waitTime/1000}s...` }
                      : j
                  ));
                  await new Promise(resolve => setTimeout(resolve, waitTime));
                  continue;
                }
                throw new Error('Max retries exceeded due to rate limiting');
              }
              throw pressError;
            }

            pressData = data;
            break;
          }

          const newMentions = pressData?.pressMentions || [];
          console.log(`Found ${newMentions.length} press mentions for ${agent.name}`);

          // Merge with existing mentions
          if (newMentions.length > 0) {
            const existingMentions = Array.isArray(agent.press_mentions) ? agent.press_mentions : [];
            const mergedMentions = [...existingMentions];
            
            newMentions.forEach((mention: any) => {
              if (!mergedMentions.some((m: any) => m.url === mention.url)) {
                mergedMentions.push(mention);
              }
            });

            const { error: updateError } = await supabase
              .from('professionals')
              .update({ 
                press_mentions: mergedMentions,
                profile_last_synthesized_at: new Date().toISOString()
              })
              .eq('id', agent.id);

            if (updateError) throw updateError;

            setJobs(prev => prev.map(j => 
              j.id === agent.id 
                ? { ...j, status: 'success', mentionsFound: newMentions.length }
                : j
            ));
          } else {
            setJobs(prev => prev.map(j => 
              j.id === agent.id 
                ? { ...j, status: 'success', mentionsFound: 0, message: 'No new mentions found' }
                : j
            ));
          }

        } catch (error) {
          console.error(`Error processing ${agent.name}:`, error);
          setJobs(prev => prev.map(j => 
            j.id === agent.id 
              ? { ...j, status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }
              : j
          ));
        }

        completedCount++;
        setProgress((completedCount / agents.length) * 100);
      };

      // Process in batches
      for (let i = 0; i < agents.length; i += batchSize) {
        if (shouldStop) {
          console.log('Process stopped by user');
          toast.info('Press enrichment stopped');
          break;
        }

        const batch = agents.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}: ${batch.map(a => a.name).join(', ')}`);
        
        await Promise.allSettled(batch.map(agent => processAgent(agent)));

        if (i + batchSize < agents.length && !shouldStop) {
          console.log(`Waiting ${batchDelay}s before next batch...`);
          await new Promise(resolve => setTimeout(resolve, batchDelay * 1000));
        }
      }

      if (!shouldStop) {
        toast.success('Bulk press enrichment complete!');
      }

    } catch (error) {
      console.error('Bulk enrichment error:', error);
      toast.error('Failed to run bulk enrichment');
    } finally {
      setIsRunning(false);
      setShouldStop(false);
    }
  };

  const stopProcess = () => {
    setShouldStop(true);
    toast.info('Stopping after current batch...');
  };

  const getStatusIcon = (status: AgentJob['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Press Enrichment</CardTitle>
        <CardDescription>
          Search for press mentions across all agents using Claude Sonnet. Merges new mentions with existing ones (deduplicates by URL).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="maxAgents">Max Agents</Label>
            <Input
              id="maxAgents"
              type="number"
              value={maxAgents}
              onChange={(e) => setMaxAgents(parseInt(e.target.value))}
              disabled={isRunning}
              min={1}
              max={500}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="batchSize">Batch Size</Label>
            <Input
              id="batchSize"
              type="number"
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value))}
              disabled={isRunning}
              min={1}
              max={10}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="batchDelay">Delay (seconds)</Label>
            <Input
              id="batchDelay"
              type="number"
              value={batchDelay}
              onChange={(e) => setBatchDelay(parseInt(e.target.value))}
              disabled={isRunning}
              min={5}
              max={60}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={runBulkEnrichment} 
            disabled={isRunning}
            className="flex-1"
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enriching... {Math.round(progress)}%
              </>
            ) : (
              'Start Bulk Enrichment'
            )}
          </Button>
          {isRunning && (
            <Button 
              onClick={stopProcess}
              variant="destructive"
              disabled={shouldStop}
            >
              {shouldStop ? 'Stopping...' : 'Stop'}
            </Button>
          )}
        </div>

        {jobs.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">
              Progress: {jobs.filter(j => j.status === 'success' || j.status === 'error').length} / {jobs.length}
            </div>
            
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {jobs.map(job => (
                <div 
                  key={job.id}
                  className="flex items-center gap-2 p-2 rounded bg-muted/30 text-sm"
                >
                  {getStatusIcon(job.status)}
                  <span className="flex-1 font-medium">{job.name}</span>
                  <span className="text-xs text-muted-foreground">{job.city}</span>
                  {job.mentionsFound !== undefined && (
                    <span className="text-muted-foreground">
                      {job.mentionsFound} new
                    </span>
                  )}
                  {job.message && (
                    <span className="text-xs text-muted-foreground">{job.message}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
