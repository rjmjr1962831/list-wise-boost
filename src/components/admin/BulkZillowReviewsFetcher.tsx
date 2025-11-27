import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Play, Loader2, CheckCircle } from 'lucide-react';

export function BulkZillowReviewsFetcher() {
  const [cities, setCities] = useState<{ slug: string; name: string; agentCount: number }[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [isStarting, setIsStarting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCities();
  }, []);

  const loadCities = async () => {
    try {
      const { data: citiesData, error } = await supabase
        .from('cities')
        .select('id, slug, name, state')
        .eq('active', true)
        .eq('state', 'Arizona')
        .order('name');

      if (error) throw error;

      // Get agent counts per city
      const citiesWithCounts = await Promise.all(
        (citiesData || []).map(async (city) => {
          const { count } = await supabase
            .from('professionals')
            .select('id', { count: 'exact', head: true })
            .eq('city_id', city.id)
            .eq('active', true)
            .not('zillow_profile_url', 'is', null);

          return {
            slug: city.slug,
            name: city.name,
            agentCount: count || 0
          };
        })
      );

      setCities(citiesWithCounts.filter(c => c.agentCount > 0));
    } catch (error) {
      console.error('Error loading cities:', error);
      toast.error('Failed to load cities');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartFetch = async () => {
    if (!selectedCity) {
      toast.error('Please select a city');
      return;
    }

    setIsStarting(true);
    try {
      const { data, error } = await supabase.functions.invoke('bulk-fetch-zillow-reviews', {
        body: { citySlug: selectedCity }
      });

      if (error) throw error;

      setIsRunning(true);
      toast.success(
        `Started fetching Zillow reviews for ${data.total} agents in ${data.city}! Running in background.`,
        { duration: 5000 }
      );

      console.log('Bulk fetch started:', data);

    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Failed to start review fetch');
    } finally {
      setIsStarting(false);
    }
  };

  const selectedCityData = cities.find(c => c.slug === selectedCity);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Zillow Reviews Fetcher</CardTitle>
        <CardDescription>
          Pre-fetch and cache Zillow reviews for all agents in a city. 
          Reviews will load instantly on agent cards after completion.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground mb-2">
            <strong>What this does:</strong>
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Fetches Zillow reviews for all agents with zillow_profile_url</li>
            <li>Skips agents with reviews cached in last 30 days</li>
            <li>Stores reviews in database for instant loading</li>
            <li>Processes in batches of 10 agents via Apify</li>
            <li>Runs completely in the background (~5-15 min per city)</li>
          </ul>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Select City</label>
          <Select value={selectedCity} onValueChange={setSelectedCity} disabled={isLoading}>
            <SelectTrigger>
              <SelectValue placeholder={isLoading ? "Loading cities..." : "Choose a city"} />
            </SelectTrigger>
            <SelectContent>
              {cities.map((city) => (
                <SelectItem key={city.slug} value={city.slug}>
                  {city.name} ({city.agentCount} agents)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedCityData && (
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-400">
              {selectedCityData.agentCount} agents with Zillow profiles will be processed
            </p>
          </div>
        )}

        <Button
          onClick={handleStartFetch}
          disabled={!selectedCity || isStarting || isRunning}
          className="w-full"
        >
          {isStarting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Starting...
            </>
          ) : isRunning ? (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Running in Background
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Start Review Fetch
            </>
          )}
        </Button>

        {isRunning && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-sm text-green-700 dark:text-green-400">
              ✓ Review fetch is running in the background. Check Cloud → Functions → bulk-fetch-zillow-reviews logs to monitor progress.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
