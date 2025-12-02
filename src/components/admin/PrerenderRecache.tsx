import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { RefreshCw, Globe, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface RecacheResult {
  batch: number;
  success: boolean;
  message: string;
  count: number;
}

interface RecacheResponse {
  success: boolean;
  totalUrls: number;
  processedUrls: number;
  totalBatches: number;
  failedBatches: number;
  results: RecacheResult[];
  error?: string;
}

export const PrerenderRecache: React.FC = () => {
  const [sitemapUrl, setSitemapUrl] = useState('https://top10lists.us/sitemap.xml');
  const [adaptiveType, setAdaptiveType] = useState<'desktop' | 'mobile'>('desktop');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<RecacheResponse | null>(null);

  const handleRecache = async () => {
    if (!sitemapUrl) {
      toast.error('Please enter a sitemap URL');
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('recache-prerender', {
        body: {
          sitemapUrl,
          adaptiveType
        }
      });

      if (error) throw error;

      setResult(data as RecacheResponse);

      if (data.success) {
        toast.success(`Successfully recached ${data.processedUrls} URLs`);
      } else if (data.failedBatches > 0) {
        toast.warning(`Recache completed with ${data.failedBatches} failed batches`);
      } else {
        toast.error(data.error || 'Recache failed');
      }
    } catch (error) {
      console.error('Recache error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to trigger recache');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Prerender.io Recache
        </CardTitle>
        <CardDescription>
          Trigger a recache of your sitemap URLs to refresh pre-rendered content for search engines and LLMs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sitemap-url">Sitemap URL</Label>
            <Input
              id="sitemap-url"
              value={sitemapUrl}
              onChange={(e) => setSitemapUrl(e.target.value)}
              placeholder="https://example.com/sitemap.xml"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adaptive-type">Device Type</Label>
            <Select value={adaptiveType} onValueChange={(v) => setAdaptiveType(v as 'desktop' | 'mobile')}>
              <SelectTrigger id="adaptive-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desktop">Desktop</SelectItem>
                <SelectItem value="mobile">Mobile</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={handleRecache} disabled={isLoading} className="w-full md:w-auto">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Recaching...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Trigger Recache
            </>
          )}
        </Button>

        {result && (
          <div className="mt-4 p-4 rounded-lg border bg-muted/50">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              Recache Results
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total URLs:</span>
                <p className="font-medium">{result.totalUrls}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Processed:</span>
                <p className="font-medium text-green-600">{result.processedUrls}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Batches:</span>
                <p className="font-medium">{result.totalBatches}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Failed:</span>
                <p className={`font-medium ${result.failedBatches > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {result.failedBatches}
                </p>
              </div>
            </div>

            {result.results && result.results.length > 0 && (
              <div className="mt-4">
                <h5 className="text-sm font-medium mb-2">Batch Details:</h5>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {result.results.map((batch) => (
                    <div
                      key={batch.batch}
                      className={`text-xs p-2 rounded ${
                        batch.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                      }`}
                    >
                      Batch {batch.batch}: {batch.success ? `✓ ${batch.count} URLs` : `✗ ${batch.message}`}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.error && (
              <div className="mt-2 text-sm text-red-600">
                Error: {result.error}
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <p><strong>Note:</strong> API access requires Prerender.io Advanced or Enterprise plan.</p>
          <p>URLs are sent in batches of 1000. Run twice (desktop + mobile) for full coverage.</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default PrerenderRecache;
