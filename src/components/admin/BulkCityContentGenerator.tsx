import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';

interface CityContentStatus {
  city_slug: string;
  city_name: string;
  has_content: boolean;
}

export function BulkCityContentGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, currentCity: '' });
  const [results, setResults] = useState<{ city: string; success: boolean; error?: string }[]>([]);

  // Fetch all active cities and their content status
  const { data: cityStatuses, refetch } = useQuery({
    queryKey: ['city-content-status'],
    queryFn: async () => {
      // Get all active cities
      const { data: cities, error: citiesError } = await supabase
        .from('cities')
        .select('slug, name')
        .eq('active', true)
        .eq('state_slug', 'arizona')
        .order('name');
      
      if (citiesError) throw citiesError;
      
      // Get existing content
      const { data: existingContent, error: contentError } = await supabase
        .from('marketing_content')
        .select('page')
        .like('page', 'city-%')
        .eq('section', 'market_overview');
      
      if (contentError) throw contentError;
      
      const contentPages = new Set(existingContent?.map(c => c.page) || []);
      
      return cities?.map(city => ({
        city_slug: city.slug,
        city_name: city.name,
        has_content: contentPages.has(`city-${city.slug}`),
      })) || [];
    },
  });

  const citiesWithoutContent = cityStatuses?.filter(c => !c.has_content) || [];
  const citiesWithContent = cityStatuses?.filter(c => c.has_content) || [];

  const generateForCity = async (citySlug: string, cityName: string, regenerate = false) => {
    const { data, error } = await supabase.functions.invoke('generate-city-content', {
      body: { citySlug, cityName, regenerate },
    });
    
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const handleBulkGenerate = async (regenerateAll = false) => {
    const citiesToProcess = regenerateAll ? (cityStatuses || []) : citiesWithoutContent;
    
    if (citiesToProcess.length === 0) {
      toast.info('All cities already have unique content');
      return;
    }

    setIsGenerating(true);
    setResults([]);
    setProgress({ current: 0, total: citiesToProcess.length, currentCity: '' });

    const newResults: { city: string; success: boolean; error?: string }[] = [];

    for (let i = 0; i < citiesToProcess.length; i++) {
      const city = citiesToProcess[i];
      setProgress({ current: i + 1, total: citiesToProcess.length, currentCity: city.city_name });

      try {
        await generateForCity(city.city_slug, city.city_name, regenerateAll);
        newResults.push({ city: city.city_name, success: true });
        
        // Add delay between API calls to avoid rate limiting
        if (i < citiesToProcess.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`Error generating content for ${city.city_name}:`, error);
        newResults.push({ 
          city: city.city_name, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }

      setResults([...newResults]);
    }

    setIsGenerating(false);
    await refetch();
    
    const successCount = newResults.filter(r => r.success).length;
    toast.success(`Generated content for ${successCount}/${citiesToProcess.length} cities`);
  };

  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>City Market Content Generator</CardTitle>
        <CardDescription>
          Generate unique, AI-written market descriptions for Arizona cities to avoid repetitive SEO content.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600">{citiesWithContent.length}</div>
            <div className="text-sm text-muted-foreground">Cities with unique content</div>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
            <div className="text-2xl font-bold text-amber-600">{citiesWithoutContent.length}</div>
            <div className="text-sm text-muted-foreground">Cities needing content</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button 
            onClick={() => handleBulkGenerate(false)} 
            disabled={isGenerating || citiesWithoutContent.length === 0}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>Generate Missing ({citiesWithoutContent.length})</>
            )}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => handleBulkGenerate(true)} 
            disabled={isGenerating}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Regenerate All
          </Button>
        </div>

        {/* Progress */}
        {isGenerating && (
          <div className="space-y-2">
            <Progress value={progressPercent} />
            <p className="text-sm text-muted-foreground">
              Processing {progress.current}/{progress.total}: {progress.currentCity}
            </p>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="max-h-64 overflow-y-auto space-y-1 border rounded-lg p-3">
            {results.map((result, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                {result.success ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
                <span className={result.success ? 'text-foreground' : 'text-red-500'}>
                  {result.city}
                  {result.error && <span className="text-xs ml-2">({result.error})</span>}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Cities List */}
        {citiesWithoutContent.length > 0 && !isGenerating && (
          <div>
            <h4 className="text-sm font-medium mb-2">Cities needing unique content:</h4>
            <div className="flex flex-wrap gap-1">
              {citiesWithoutContent.map(city => (
                <span 
                  key={city.city_slug} 
                  className="bg-muted px-2 py-1 rounded text-xs"
                >
                  {city.city_name}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
