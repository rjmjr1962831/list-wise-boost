import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { Loader2, ChevronDown } from 'lucide-react';
import { ProfessionalCard } from '@/components/ProfessionalCard';

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
  company: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  description: string | null;
  image_url: string | null;
  specialty: string[] | null;
  license_number: string | null;
  current_listings: number | null;
  total_sales: number | null;
  years_experience: number | null;
  zillow_profile_url: string | null;
  rank: number;
  type: string;
  address: string | null;
  category_id: string;
  city_id: string;
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
  const [rawEnrichResponse, setRawEnrichResponse] = useState<any>(null);
  const [debugOpen, setDebugOpen] = useState(false);

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
    if (!selectedCategoryId) {
      toast.error('Please select a category');
      return;
    }
    
    if (!selectedCityId) {
      toast.error('Please select a city');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-agenscrape-agents', {
        body: {
          locationText: locationText.trim() || undefined,
          cityId: selectedCityId || undefined,
          categoryId: selectedCategoryId,
        },
      });

      if (error) throw error;

      setLastResult(data);
      toast.success(`Successfully imported ${data.imported} out of ${data.total} agent profiles`);
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
    setRawEnrichResponse(null);
    
    try {
      const requestBody = {
        profileUrls: lastResult.agents.map(a => a.profileUrl),
        professionalIds: lastResult.agents.map(a => a.id),
      };

      console.log('Starting enrichment:', requestBody);

      const { data, error } = await supabase.functions.invoke('fetch-apify-zillow-cheerio', {
        body: requestBody,
      });

      setRawEnrichResponse({ request: requestBody, response: data, error });

      if (error) throw error;

      if (!data?.success) {
        console.warn('Enrich request failed:', data);
        toast.error(data?.error || 'Failed to start enrichment process');
        setDebugOpen(true);
        return;
      }

      // Background processing started - show message and start polling
      toast.success(`Enrichment started for ${lastResult.agents.length} agents. This may take several minutes...`);
      
      // Poll for completion every 10 seconds
      let pollCount = 0;
      const maxPolls = 60; // 10 minutes max
      const pollInterval = setInterval(async () => {
        pollCount++;
        
        // Fetch the updated professional records to check progress
        const { data: professionals, error: fetchError } = await supabase
          .from('professionals')
          .select('*')
          .in('id', lastResult.agents.map(a => a.id));

        if (fetchError) {
          console.error('Error fetching professionals:', fetchError);
          clearInterval(pollInterval);
          setIsEnriching(false);
          return;
        }

        // Check how many have been enriched (have zillow_data_fetched_at set)
        const enrichedCount = professionals?.filter(p => p.zillow_data_fetched_at).length || 0;
        
        console.log(`Poll ${pollCount}: ${enrichedCount}/${lastResult.agents.length} enriched`);

        // If all enriched or max polls reached, stop polling
        if (enrichedCount === lastResult.agents.length || pollCount >= maxPolls) {
          clearInterval(pollInterval);
          setIsEnriching(false);
          setEnrichedData(professionals || []);
          
          if (enrichedCount === lastResult.agents.length) {
            toast.success(`Successfully enriched all ${enrichedCount} agents!`);
          } else {
            toast.info(`Enriched ${enrichedCount} of ${lastResult.agents.length} agents`);
          }
        }
      }, 10000); // Poll every 10 seconds
    } catch (error: any) {
      console.error('Enrich error:', error);
      toast.error(error.message || 'Failed to enrich agents');
      setDebugOpen(true);
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
          <Label htmlFor="city">City *</Label>
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
          <p className="text-xs text-muted-foreground mt-1">
            Required - agents will be associated with this city
          </p>
        </div>

        <div>
          <Label htmlFor="category">Category *</Label>
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
          <Label htmlFor="locationText">Search Location (Optional)</Label>
          <Input
            id="locationText"
            placeholder="e.g., Scottsdale AZ"
            value={locationText}
            onChange={(e) => setLocationText(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Optional: Enter location as "City ST" (no comma, state abbreviation). If blank, will search using selected city name.
          </p>
        </div>

        <Button 
          onClick={handleImport} 
          disabled={isLoading || !selectedCategoryId || !selectedCityId}
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
        <div className="mt-6 space-y-4">
          <div className="p-4 bg-muted rounded-lg">
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
                  <div className="max-h-[800px] overflow-y-auto space-y-6">
                    {enrichedData.map((agent) => (
                      <ProfessionalCard
                        key={agent.id}
                        professional={{
                          id: agent.id,
                          rank: agent.rank,
                          name: agent.name,
                          company: agent.company || '',
                          rating: 0, // Will be populated from Zillow reviews if available
                          reviews: 0,
                          specialties: agent.specialty || [],
                          address: agent.address || '',
                          phone: agent.phone || '',
                          email: agent.email || '',
                          website: agent.website || '',
                          description: agent.description || '',
                          stats: {
                            currentListings: agent.current_listings,
                            totalSales: agent.total_sales,
                            yearsExperience: agent.years_experience,
                          },
                          verified: !!agent.license_number,
                          image: agent.image_url || '',
                          license_number: agent.license_number,
                        }}
                        accentColor="primary"
                      />
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

          {rawEnrichResponse && (
            <Collapsible open={debugOpen} onOpenChange={setDebugOpen}>
              <Card className="p-4 border-yellow-500/50 bg-yellow-500/5">
                <CollapsibleTrigger className="flex items-center justify-between w-full">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    🔍 Debug: memo23 Enrichment Request/Response
                  </h3>
                  <ChevronDown className={`h-5 w-5 transition-transform ${debugOpen ? 'rotate-180' : ''}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Zillow URLs Sent ({rawEnrichResponse.request?.profileUrls?.length || 0}):</h4>
                    <div className="bg-background p-3 rounded max-h-48 overflow-y-auto text-xs font-mono">
                      {rawEnrichResponse.request?.profileUrls?.map((url: string, idx: number) => (
                        <div key={idx} className="py-1 border-b border-border/30 last:border-0">
                          {idx + 1}. {url}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2">Raw Apify Response:</h4>
                    <pre className="bg-background p-3 rounded max-h-64 overflow-auto text-xs">
                      {JSON.stringify(rawEnrichResponse.response, null, 2)}
                    </pre>
                  </div>
                  {rawEnrichResponse.error && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 text-destructive">Error:</h4>
                      <pre className="bg-destructive/10 p-3 rounded text-xs text-destructive">
                        {JSON.stringify(rawEnrichResponse.error, null, 2)}
                      </pre>
                    </div>
                  )}
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}
        </div>
      )}
    </Card>
  );
}
