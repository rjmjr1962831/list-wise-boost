import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface City {
  id: string;
  name: string;
  state: string;
}

interface Category {
  id: string;
  name: string;
}

interface ImportResult {
  imported: number;
  total: number;
  agents?: Array<{ name: string; profileUrl: string; id: string }>;
}

interface EnrichedAgent {
  id: string;
  name: string;
  photo: string | null;
  totalSales: number;
  currentListings: number;
  reviewsCount: number;
  rating: number;
}

export function AgenScrapeImporter() {
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [locationText, setLocationText] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);
  const [enrichedData, setEnrichedData] = useState<EnrichedAgent[] | null>(null);

  useEffect(() => {
    fetchCitiesAndCategories();
  }, []);

  const fetchCitiesAndCategories = async () => {
    const { data: citiesData } = await supabase
      .from('cities')
      .select('*')
      .eq('active', true)
      .order('state, name');

    const { data: categoriesData } = await supabase
      .from('categories')
      .select('*')
      .eq('active', true)
      .order('name');

    if (citiesData) setCities(citiesData);
    if (categoriesData) setCategories(categoriesData);
  };

  const handleImport = async () => {
    if (!selectedCityId || !selectedCategoryId || !locationText.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-agenscrape-agents', {
        body: {
          locationText: locationText.trim(),
          cityId: selectedCityId,
          categoryId: selectedCategoryId,
        },
      });

      if (error) throw error;

      setLastResult(data);
      toast.success(`Successfully imported ${data.imported} out of ${data.total} agent profiles`);
      
      // Keep form filled so user can see what they just imported
      // User can manually clear if they want to do another import
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Failed to import agents');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnrich = async () => {
    if (!lastResult?.agents || lastResult.agents.length === 0) {
      toast.error('No agents to enrich');
      return;
    }

    setIsEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-apify-zillow-cheerio', {
        body: {
          profileUrls: lastResult.agents.map(a => a.profileUrl),
          professionalIds: lastResult.agents.map(a => a.id),
        },
      });

      if (error) throw error;

      // Handle cases where the edge function returns success: false or no agents
      if (!data?.success || !data.agents || data.agents.length === 0) {
        console.warn('Enrich returned no detailed agent data:', data);
        toast.error(data?.error || 'Apify returned no detailed agent data. Make sure memo23 has access to these Zillow URLs.');
        return;
      }

      setEnrichedData(data.agents);
      toast.success(`Successfully enriched ${data.enriched} agent profiles with detailed data`);
    } catch (error: any) {
      console.error('Enrich error:', error);
      toast.error(error.message || 'Failed to enrich agents');
    } finally {
      setIsEnriching(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-4">Import Agents from AgenScrape</h2>
      <p className="text-muted-foreground mb-6">
        Import real estate agent profile URLs from Zillow using location search (ZIP code, city, or address)
      </p>

      <div className="space-y-4">
        <div>
          <Label htmlFor="city">City</Label>
          <Select value={selectedCityId} onValueChange={setSelectedCityId}>
            <SelectTrigger id="city">
              <SelectValue placeholder="Select city" />
            </SelectTrigger>
            <SelectContent>
              {cities.map((city) => (
                <SelectItem key={city.id} value={city.id}>
                  {city.name}, {city.state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="category">Category</Label>
          <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
            <SelectTrigger id="category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="locationText">Location</Label>
          <Input
            id="locationText"
            placeholder="e.g., 10001, New York NY, Los Angeles CA"
            value={locationText}
            onChange={(e) => setLocationText(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Enter ZIP code, city name with state, or full address
          </p>
        </div>

        <Button 
          onClick={handleImport} 
          disabled={isLoading || !selectedCityId || !selectedCategoryId || !locationText.trim()}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importing agent profiles...
            </>
          ) : (
            'Import Agents'
          )}
        </Button>
      </div>

      {lastResult && (
        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Last Import Results</h3>
          <p className="text-sm mb-4">
            Successfully imported <strong>{lastResult.imported}</strong> out of <strong>{lastResult.total}</strong> agents
          </p>
          
          {lastResult.agents && lastResult.agents.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium">Imported Agents:</h4>
                {!enrichedData && (
                  <Button 
                    onClick={handleEnrich} 
                    disabled={isEnriching}
                    size="sm"
                    variant="secondary"
                  >
                    {isEnriching ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        Enriching...
                      </>
                    ) : (
                      'Enrich with Details'
                    )}
                  </Button>
                )}
              </div>

              {enrichedData ? (
                <div className="max-h-96 overflow-y-auto space-y-3">
                  {enrichedData.map((agent, idx) => (
                    <div key={idx} className="p-3 bg-background rounded-lg border">
                      <div className="flex gap-3">
                        {agent.photo && (
                          <img 
                            src={agent.photo} 
                            alt={agent.name}
                            className="w-16 h-16 rounded-full object-cover"
                          />
                        )}
                        <div className="flex-1">
                          <div className="font-semibold text-base mb-1">{agent.name}</div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                            <div>
                              <span className="font-medium">Sales:</span> {agent.totalSales}
                            </div>
                            <div>
                              <span className="font-medium">Listings:</span> {agent.currentListings}
                            </div>
                            <div>
                              <span className="font-medium">Reviews:</span> {agent.reviewsCount}
                            </div>
                            <div>
                              <span className="font-medium">Rating:</span> {agent.rating.toFixed(1)} ⭐
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {lastResult.agents.map((agent, idx) => (
                    <div key={idx} className="text-sm p-2 bg-background rounded border">
                      <div className="font-medium">{agent.name}</div>
                      <a 
                        href={agent.profileUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline break-all"
                      >
                        {agent.profileUrl}
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
