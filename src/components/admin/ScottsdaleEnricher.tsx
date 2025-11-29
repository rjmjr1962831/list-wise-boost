import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Play } from 'lucide-react';

export function ScottsdaleEnricher() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, errors: 0 });

  const handleEnrich = async () => {
    try {
      setIsRunning(true);
      setProgress({ current: 0, total: 0, errors: 0 });
      
      toast.info('Starting Scottsdale enrichment for 200 agents...');
      
      const { data, error } = await supabase.functions.invoke('import-city-agents', {
        body: {
          cityId: 'afe374d7-0de5-4574-99bc-1a596df7d995', // Scottsdale
          categoryId: '1384f127-fc2e-4693-9b8f-406451adf3aa', // Real Estate Agents
          maxResults: 200,
          forceRefresh: false,
          stopOnApiFailure: true // Stop if Claude/Perplexity fail
        }
      });

      if (error) {
        console.error('Enrichment error:', error);
        
        // Check if it's an API failure
        if (error.message?.includes('Claude') || error.message?.includes('Perplexity') || 
            error.message?.includes('429') || error.message?.includes('rate limit')) {
          toast.error('🚨 API FAILURE: Claude or Perplexity stopped responding. Batch halted.', {
            duration: 10000,
          });
        } else {
          toast.error('Enrichment failed: ' + error.message);
        }
      } else {
        console.log('Enrichment response:', data);
        
        if (data?.apiFailure) {
          toast.error(`🚨 API FAILURE at agent ${data.processedCount}: ${data.failureReason}`, {
            duration: 10000,
          });
        } else {
          toast.success(data?.message || 'Scottsdale enrichment completed');
        }
      }
    } catch (error: any) {
      console.error('Error:', error);
      
      // Check for API-specific errors
      if (error.message?.includes('429') || error.message?.includes('rate limit') ||
          error.message?.includes('Claude') || error.message?.includes('Perplexity')) {
        toast.error('🚨 API FAILURE: Rate limit or API error detected. Batch stopped.', {
          duration: 10000,
        });
      } else {
        toast.error('Error: ' + error.message);
      }
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scottsdale Enrichment</CardTitle>
        <CardDescription>
          Enrich existing Scottsdale agents with memo23 data (4.9+ rating, 200+ reviews)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground space-y-2">
          <p>This will:</p>
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li>Process 200 Scottsdale agents (4.9+ rating, 200+ reviews)</li>
            <li>Reuse existing enriched data across cities</li>
            <li>Call memo23 + Claude press research + profile synthesis</li>
            <li>🚨 Auto-stop if Claude or Perplexity APIs fail</li>
            <li>Run in background (won't block UI)</li>
          </ul>
        </div>
        
        <Button 
          onClick={handleEnrich}
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enrichment Running...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Start 200 Agent Enrichment
            </>
          )}
        </Button>
        
        {isRunning && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              Check edge function logs (import-city-agents) to monitor progress
            </div>
            <div className="text-xs text-amber-600 font-medium">
              ⚠️ Batch will auto-stop if APIs fail - you will be alerted
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
