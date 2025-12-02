import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { RefreshCw, Globe, CheckCircle, XCircle, Loader2, Square } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';

// Hardcoded URLs to recache (matching Python script)
const URLS_TO_RECACHE = [
  "https://top10lists.us/",
  "https://top10lists.us/about",
  "https://top10lists.us/about/ranking-methodology",
  "https://top10lists.us/arizona",
  "https://top10lists.us/arizona/anthem/top10realestateagents",
  "https://top10lists.us/arizona/apache-junction/top10realestateagents",
  "https://top10lists.us/arizona/avondale/top10realestateagents",
  "https://top10lists.us/arizona/benson/top10realestateagents",
  "https://top10lists.us/arizona/buckeye/top10realestateagents",
  "https://top10lists.us/arizona/bullhead-city/top10realestateagents",
  "https://top10lists.us/arizona/carefree/top10realestateagents",
  "https://top10lists.us/arizona/casa-grande/top10realestateagents",
  "https://top10lists.us/arizona/cave-creek/top10realestateagents",
  "https://top10lists.us/arizona/chandler/top10realestateagents",
  "https://top10lists.us/arizona/coolidge/top10realestateagents",
  "https://top10lists.us/arizona/cottonwood/top10realestateagents",
  "https://top10lists.us/arizona/douglas/top10realestateagents",
  "https://top10lists.us/arizona/el-mirage/top10realestateagents",
  "https://top10lists.us/arizona/flagstaff/top10realestateagents",
  "https://top10lists.us/arizona/florence/top10realestateagents",
  "https://top10lists.us/arizona/fountain-hills/top10realestateagents",
  "https://top10lists.us/arizona/gila-bend/top10realestateagents",
  "https://top10lists.us/arizona/gilbert/top10realestateagents",
  "https://top10lists.us/arizona/glendale/top10realestateagents",
  "https://top10lists.us/arizona/goodyear/top10realestateagents",
  "https://top10lists.us/arizona/kingman/top10realestateagents",
  "https://top10lists.us/arizona/lake-havasu-city/top10realestateagents",
  "https://top10lists.us/arizona/litchfield-park/top10realestateagents",
  "https://top10lists.us/arizona/maricopa/top10realestateagents",
  "https://top10lists.us/arizona/mesa/top10realestateagents",
  "https://top10lists.us/arizona/nogales/top10realestateagents",
  "https://top10lists.us/arizona/paradise-valley/top10realestateagents",
  "https://top10lists.us/arizona/payson/top10realestateagents",
  "https://top10lists.us/arizona/peoria/top10realestateagents",
  "https://top10lists.us/arizona/phoenix/top10realestateagents",
  "https://top10lists.us/arizona/prescott/top10realestateagents",
  "https://top10lists.us/arizona/prescott-valley/top10realestateagents",
  "https://top10lists.us/arizona/queen-creek/top10realestateagents",
  "https://top10lists.us/arizona/san-tan-valley/top10realestateagents",
  "https://top10lists.us/arizona/scottsdale/top10realestateagents",
  "https://top10lists.us/arizona/sedona/top10realestateagents",
  "https://top10lists.us/arizona/show-low/top10realestateagents",
  "https://top10lists.us/arizona/sierra-vista/top10realestateagents",
  "https://top10lists.us/arizona/surprise/top10realestateagents",
  "https://top10lists.us/arizona/tempe/top10realestateagents",
  "https://top10lists.us/arizona/tolleson/top10realestateagents",
  "https://top10lists.us/arizona/tucson/top10realestateagents",
  "https://top10lists.us/arizona/west-valley/top10realestateagents",
  "https://top10lists.us/arizona/wickenburg/top10realestateagents",
  "https://top10lists.us/arizona/winslow/top10realestateagents",
  "https://top10lists.us/arizona/youngtown/top10realestateagents",
  "https://top10lists.us/arizona/yuma/top10realestateagents",
];

interface UrlResult {
  url: string;
  success: boolean;
  message?: string;
}

const DELAY_BETWEEN_REQUESTS = 1000; // 1 second delay

export const PrerenderRecache: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<UrlResult[]>([]);
  const [successCount, setSuccessCount] = useState(0);
  const [failCount, setFailCount] = useState(0);
  const abortRef = useRef(false);

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
    setIsRunning(true);
    setResults([]);
    setCurrentIndex(0);
    setSuccessCount(0);
    setFailCount(0);
    abortRef.current = false;

    let successes = 0;
    let failures = 0;

    for (let i = 0; i < URLS_TO_RECACHE.length; i++) {
      if (abortRef.current) {
        toast.info('Recache stopped by user');
        break;
      }

      const url = URLS_TO_RECACHE[i];
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
      if (i < URLS_TO_RECACHE.length - 1 && !abortRef.current) {
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

  const progress = URLS_TO_RECACHE.length > 0 
    ? Math.round((currentIndex / URLS_TO_RECACHE.length) * 100) 
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Prerender.io Recache
        </CardTitle>
        <CardDescription>
          Recache {URLS_TO_RECACHE.length} URLs to refresh pre-rendered content for search engines and LLMs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          {!isRunning ? (
            <Button onClick={handleStart} className="w-full md:w-auto">
              <RefreshCw className="mr-2 h-4 w-4" />
              Start Recache ({URLS_TO_RECACHE.length} URLs)
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
                <span className="font-medium">{currentIndex} / {URLS_TO_RECACHE.length} ({progress}%)</span>
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
            {isRunning && currentIndex > 0 && currentIndex <= URLS_TO_RECACHE.length && (
              <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm truncate">{URLS_TO_RECACHE[currentIndex - 1]}</span>
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
        </div>
      </CardContent>
    </Card>
  );
};

export default PrerenderRecache;
