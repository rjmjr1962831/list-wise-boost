import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { RefreshCw, Globe, CheckCircle, XCircle, Loader2, Square } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';

const BASE_URL = "https://top10lists.us";

// Static pages that always need caching
const STATIC_PAGES = [
  "/",
  "/about",
  "/about/ranking-methodology",
  "/privacy",
  "/terms",
  "/sms-terms",
  "/agent-info",
  "/check-profile",
];

// Build all URLs dynamically from cities
const buildUrlsFromCities = (cities: { slug: string; state_slug: string }[]): string[] => {
  const urls: string[] = [];
  
  // Add static pages
  STATIC_PAGES.forEach(page => {
    urls.push(`${BASE_URL}${page}`);
  });
  
  // Add state landing page
  urls.push(`${BASE_URL}/arizona`);
  
  // For each city, add all page variants
  cities.forEach(city => {
    const cityPath = `/${city.state_slug}/${city.slug}`;
    
    // Main listing page
    urls.push(`${BASE_URL}${cityPath}/top10realestateagents`);
    
    // Q&A landing pages
    urls.push(`${BASE_URL}${cityPath}/best-real-estate-agents`);
    urls.push(`${BASE_URL}${cityPath}/best-real-estate-agents-2025`);
  });
  
  return urls;
};

interface UrlResult {
  url: string;
  success: boolean;
  message?: string;
}

const DELAY_BETWEEN_REQUESTS = 1000; // 1 second delay

export const PrerenderRecache: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<UrlResult[]>([]);
  const [successCount, setSuccessCount] = useState(0);
  const [failCount, setFailCount] = useState(0);
  const [urls, setUrls] = useState<string[]>([]);
  const abortRef = useRef(false);

  // Load cities and build URLs on mount
  useEffect(() => {
    const loadCities = async () => {
      setIsLoading(true);
      try {
        const { data: cities, error } = await supabase
          .from('cities')
          .select('slug, state_slug')
          .eq('active', true)
          .order('name');
        
        if (error) {
          console.error('Error loading cities:', error);
          toast.error('Failed to load cities');
          return;
        }
        
        const builtUrls = buildUrlsFromCities(cities || []);
        setUrls(builtUrls);
      } catch (err) {
        console.error('Exception loading cities:', err);
        toast.error('Failed to load cities');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadCities();
  }, []);

  const recacheUrl = async (url: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('recache-prerender-single', {
        body: { url }
      });

      if (error) {
        console.error(`Error recaching ${url}:`, error);
        return false;
      }

      return data?.success === true;
    } catch (err) {
      console.error(`Exception recaching ${url}:`, err);
      return false;
    }
  };

  const handleStart = async () => {
    if (urls.length === 0) {
      toast.error('No URLs to recache');
      return;
    }
    
    setIsRunning(true);
    setResults([]);
    setCurrentIndex(0);
    setSuccessCount(0);
    setFailCount(0);
    abortRef.current = false;

    let successes = 0;
    let failures = 0;

    for (let i = 0; i < urls.length; i++) {
      if (abortRef.current) {
        toast.info('Recache stopped by user');
        break;
      }

      const url = urls[i];
      setCurrentIndex(i + 1);

      const success = await recacheUrl(url);
      
      const result: UrlResult = {
        url,
        success,
        message: success ? 'Success' : 'Failed'
      };

      setResults(prev => [...prev, result]);

      if (success) {
        successes++;
        setSuccessCount(successes);
      } else {
        failures++;
        setFailCount(failures);
      }

      // Delay between requests (skip on last URL)
      if (i < urls.length - 1 && !abortRef.current) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
      }
    }

    setIsRunning(false);
    
    if (!abortRef.current) {
      toast.success(`Recache complete: ${successes} successful, ${failures} failed`);
    }
  };

  const handleStop = () => {
    abortRef.current = true;
  };

  const progress = urls.length > 0 
    ? Math.round((currentIndex / urls.length) * 100) 
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Prerender.io Recache
        </CardTitle>
        <CardDescription>
          {isLoading ? 'Loading URLs...' : `Recache ${urls.length} URLs to refresh pre-rendered content for search engines and LLMs.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          {!isRunning ? (
            <Button onClick={handleStart} disabled={isLoading || urls.length === 0} className="w-full md:w-auto">
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {isLoading ? 'Loading...' : `Start Recache (${urls.length} URLs)`}
            </Button>
          ) : (
            <Button onClick={handleStop} variant="destructive" className="w-full md:w-auto">
              <Square className="mr-2 h-4 w-4" />
              Stop
            </Button>
          )}
        </div>

        {(isRunning || results.length > 0) && (
          <div className="space-y-4">
            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{currentIndex} / {urls.length} ({progress}%)</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">{currentIndex}</div>
                <div className="text-xs text-muted-foreground">Processed</div>
              </div>
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950">
                <div className="text-2xl font-bold text-green-600">{successCount}</div>
                <div className="text-xs text-muted-foreground">Success</div>
              </div>
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950">
                <div className="text-2xl font-bold text-red-600">{failCount}</div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
            </div>

            {/* Current URL */}
            {isRunning && currentIndex > 0 && currentIndex <= urls.length && (
              <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm truncate">{urls[currentIndex - 1]}</span>
              </div>
            )}

            {/* Results log */}
            <ScrollArea className="h-64 rounded-lg border">
              <div className="p-2 space-y-1">
                {results.map((result, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 text-xs p-2 rounded ${
                      result.success 
                        ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200' 
                        : 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200'
                    }`}
                  >
                    {result.success ? (
                      <CheckCircle className="h-3 w-3 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-3 w-3 flex-shrink-0" />
                    )}
                    <span className="truncate">[{idx + 1}] {result.url}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <p><strong>Note:</strong> Each URL is recached individually with a 1-second delay to prevent rate limiting.</p>
          <p className="mt-1">Includes: static pages, city listing pages, and Q&A landing pages for all active cities.</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default PrerenderRecache;
