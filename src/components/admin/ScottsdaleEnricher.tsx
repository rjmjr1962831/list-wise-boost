import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Play } from 'lucide-react';

export function ScottsdaleEnricher() {
  const [isRunning, setIsRunning] = useState(false);

  const handleEnrich = async () => {
    try {
      setIsRunning(true);
      
      toast.info('Starting Scottsdale enrichment...');
      
      const { data, error } = await supabase.functions.invoke('import-city-agents', {
        body: {
          cityId: 'afe374d7-0de5-4574-99bc-1a596df7d995', // Scottsdale
          categoryId: '1384f127-fc2e-4693-9b8f-406451adf3aa', // Real Estate Agents
          maxResults: 100,
          forceRefresh: false // Just enrich existing agents
        }
      });

      if (error) {
        console.error('Enrichment error:', error);
        toast.error('Enrichment failed: ' + error.message);
      } else {
        console.log('Enrichment response:', data);
        toast.success(data?.message || 'Scottsdale enrichment started in background');
      }
    } catch (error: any) {
      console.error('Error:', error);
      toast.error('Error: ' + error.message);
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
            <li>Process ~1,028 Scottsdale agents that need enrichment</li>
            <li>Filter for 4.9+ star ratings and 200+ reviews</li>
            <li>Reuse existing enriched data where possible</li>
            <li>Call memo23 actor for new enrichments</li>
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
              Start Scottsdale Enrichment
            </>
          )}
        </Button>
        
        {isRunning && (
          <div className="text-sm text-muted-foreground">
            Check edge function logs (import-city-agents) to monitor progress
          </div>
        )}
      </CardContent>
    </Card>
  );
}
