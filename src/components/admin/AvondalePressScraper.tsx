import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';

interface AgentJob {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  mentionsFound?: number;
  message?: string;
}

export default function AvondalePressScraper() {
  const [isRunning, setIsRunning] = useState(false);
  const [jobs, setJobs] = useState<AgentJob[]>([]);
  const [progress, setProgress] = useState(0);
  const [shouldStop, setShouldStop] = useState(false);
  const [testMode, setTestMode] = useState(false);

  const runPressScraper = async (isTest: boolean = false) => {
    setIsRunning(true);
    setJobs([]);
    setProgress(0);
    setShouldStop(false);
    setTestMode(isTest);

    try {
      // Get Avondale city and category IDs
      const { data: city } = await supabase
        .from('cities')
        .select('id, name, state')
        .eq('slug', 'avondale')
        .single();

      const { data: category } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', 'top10realestateagents')
        .single();

      if (!city || !category) {
        toast.error('Failed to find Avondale or real estate category');
        return;
      }

      // Fetch agents (2 for test, 10 for full run)
      const agentLimit = isTest ? 2 : 10;
      const { data: agents, error } = await supabase
        .from('professionals')
        .select('id, name, company, business_name, press_mentions')
        .eq('city_id', city.id)
        .eq('category_id', category.id)
        .eq('active', true)
        .order('rank')
        .limit(agentLimit);

      if (error || !agents || agents.length === 0) {
        toast.error('No agents found in Avondale');
        return;
      }

      console.log(`Found ${agents.length} Avondale agents`);

      // Initialize jobs
      const initialJobs: AgentJob[] = agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        status: 'pending'
      }));
      setJobs(initialJobs);

      // Process agents in parallel batches of 3
      const BATCH_SIZE = 3;
      const BATCH_DELAY = 12000; // 12 seconds between batches (increased for Sonnet)
      let completedCount = 0;

      // Helper function to process a single agent
      const processAgent = async (agent: typeof agents[0]) => {
        // Update status to running
        setJobs(prev => prev.map(j => 
          j.id === agent.id ? { ...j, status: 'running' } : j
        ));

        try {
          // Add retry logic for rate limits
          let retryCount = 0;
          const maxRetries = 3;
          let pressData = null;
          let mentions = [];

          while (retryCount <= maxRetries) {
            const { data, error: pressError } = await supabase.functions.invoke('search-agent-press-claude', {
              body: {
                agentName: agent.name,
                company: agent.company,
                businessName: agent.business_name,
                city: city.name,
                state: city.state
              }
            });

            // Check for rate limit error
            if (pressError) {
              const errorMessage = pressError.message || '';
              if (errorMessage.includes('429') || errorMessage.includes('Rate limited') || errorMessage.includes('rate_limit')) {
                retryCount++;
                if (retryCount <= maxRetries) {
                  const waitTime = 30000 * retryCount; // 30s, 60s, 90s
                  console.log(`Rate limited on ${agent.name}, waiting ${waitTime/1000}s before retry ${retryCount}/${maxRetries}...`);
                  setJobs(prev => prev.map(j => 
                    j.id === agent.id 
                      ? { ...j, message: `Rate limited, retrying in ${waitTime/1000}s...` }
                      : j
                  ));
                  await new Promise(resolve => setTimeout(resolve, waitTime));
                  continue;
                } else {
                  throw new Error('Max retries exceeded due to rate limiting');
                }
              }
              throw pressError;
            }

            pressData = data;
            mentions = data?.mentions || [];
            break;
          }
          console.log(`Found ${mentions.length} press mentions for ${agent.name}`);

          // Update agent in database if mentions found
          if (mentions.length > 0) {
            const { error: updateError } = await supabase
              .from('professionals')
              .update({ press_mentions: mentions })
              .eq('id', agent.id);

            if (updateError) throw updateError;

            setJobs(prev => prev.map(j => 
              j.id === agent.id 
                ? { ...j, status: 'success', mentionsFound: mentions.length }
                : j
            ));
          } else {
            setJobs(prev => prev.map(j => 
              j.id === agent.id 
                ? { ...j, status: 'success', mentionsFound: 0, message: 'No mentions found' }
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

      // Split agents into batches and process each batch in parallel
      for (let i = 0; i < agents.length; i += BATCH_SIZE) {
        // Check if user requested stop
        if (shouldStop) {
          console.log('Process stopped by user');
          toast.info('Press scraping stopped');
          break;
        }

        const batch = agents.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.map(a => a.name).join(', ')}`);
        
        // Process all agents in this batch simultaneously
        await Promise.allSettled(batch.map(agent => processAgent(agent)));

        // Add delay between batches (except after the last batch)
        if (i + BATCH_SIZE < agents.length && !shouldStop) {
          console.log(`Waiting ${BATCH_DELAY / 1000}s before next batch...`);
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      }

      if (!shouldStop) {
        toast.success('Press scraping complete!');
      }

    } catch (error) {
      console.error('Press scraper error:', error);
      toast.error('Failed to run press scraper');
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
        <CardTitle>Avondale Press Scraper (Enhanced)</CardTitle>
        <CardDescription>
          Search for press mentions using Claude Sonnet with 6 web searches per agent (TV, awards, WSJ rankings, podcasts, speaking, industry press). Test with 2 agents first (~2 min) or run full batch of 10 (~6-8 min).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={() => runPressScraper(true)} 
            disabled={isRunning}
            variant="outline"
            className="flex-1"
          >
            {isRunning && testMode ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing... {Math.round(progress)}%
              </>
            ) : (
              'Test Run (2 Agents)'
            )}
          </Button>
          <Button 
            onClick={() => runPressScraper(false)} 
            disabled={isRunning}
            className="flex-1"
          >
            {isRunning && !testMode ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scraping... {Math.round(progress)}%
              </>
            ) : (
              'Full Run (10 Agents)'
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
                  {job.mentionsFound !== undefined && (
                    <span className="text-muted-foreground">
                      {job.mentionsFound} mention{job.mentionsFound !== 1 ? 's' : ''}
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
