import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Play, Loader2 } from 'lucide-react';

export function PhoenixEnricher() {
  const [isRunning, setIsRunning] = useState(false);

  const handleEnrich = async () => {
    try {
      setIsRunning(true);
      
      toast.info('Starting Greater Phoenix area enrichment (4.8★ + 100+ reviews)...');
      
      // Get Phoenix city ID
      const { data: cityData } = await supabase
        .from('cities')
        .select('id')
        .eq('name', 'Phoenix')
        .eq('state', 'Arizona')
        .single();

      if (!cityData) {
        throw new Error('Phoenix city not found');
      }

      // Get Real Estate Agents category ID
      const { data: categoryData } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', 'top10realestateagents')
        .single();

      if (!categoryData) {
        throw new Error('Real Estate Agents category not found');
      }

      const { data, error } = await supabase.functions.invoke('import-city-agents', {
        body: {
          cityId: cityData.id,
          categoryId: categoryData.id,
          maxResults: 100,
          forceRefresh: true
        }
      });

      if (error) {
        throw error;
      }

      toast.success(
        data?.message || 'Phoenix enrichment started successfully. Check logs for progress.',
        { duration: 5000 }
      );

    } catch (error: any) {
      console.error('Enrichment error:', error);
      toast.error(error.message || 'Failed to start enrichment');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Phoenix Area Enrichment</CardTitle>
        <CardDescription>
          Run getdataforme scraper for Greater Phoenix area. Filters for profiles with 4.8★ rating minimum and 100+ reviews.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground space-y-2">
          <p><strong>Process:</strong></p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Scrapes Phoenix agents via getdataforme (agenscrape)</li>
            <li>Filters profiles: ≥4.8 stars, ≥100 reviews</li>
            <li>Enriches qualifying agents with memo23</li>
            <li>Reuses existing enriched data where available</li>
          </ol>
        </div>

        <Button 
          onClick={handleEnrich} 
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Start Phoenix Enrichment
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
