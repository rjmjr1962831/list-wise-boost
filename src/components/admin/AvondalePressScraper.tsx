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

  const runPressScraper = async () => {
    setIsRunning(true);
    setJobs([]);
    setProgress(0);

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

      // Fetch the 10 Avondale agents
      const { data: agents, error } = await supabase
        .from('professionals')
        .select('id, name, company, business_name, press_mentions')
        .eq('city_id', city.id)
        .eq('category_id', category.id)
        .eq('active', true)
        .order('rank')
        .limit(10);

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

      // Process agents sequentially with delay
      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        
        // Update status to running
        setJobs(prev => prev.map(j => 
          j.id === agent.id ? { ...j, status: 'running' } : j
        ));

        try {
          // Call search-agent-press function
          const { data: pressData, error: pressError } = await supabase.functions.invoke('search-agent-press', {
            body: {
              agentName: agent.name,
              company: agent.company,
              businessName: agent.business_name,
              city: city.name,
              state: city.state
            }
          });

          if (pressError) throw pressError;

          const mentions = pressData?.mentions || [];
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

        setProgress(((i + 1) / agents.length) * 100);

        // Add 2 second delay between requests (except after last one)
        if (i < agents.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      toast.success('Press scraping complete!');

    } catch (error) {
      console.error('Press scraper error:', error);
      toast.error('Failed to run press scraper');
    } finally {
      setIsRunning(false);
    }
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
        <CardTitle>Avondale Press Scraper</CardTitle>
        <CardDescription>
          Search for press mentions for the top 10 Avondale real estate agents using 6 parallel targeted queries (major publications, industry press, local news, Google News, awards, interviews)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runPressScraper} 
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Scraping... {Math.round(progress)}%
            </>
          ) : (
            'Start Press Search'
          )}
        </Button>

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
