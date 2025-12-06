import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Flame, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function SinglePageCacheWarm() {
  const [url, setUrl] = useState('https://top10lists.us/');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    setResult(null);
  };

  const handleWarmCache = async () => {
    if (!url.trim()) {
      toast.error('Please enter a URL');
      return;
    }

    if (!url.startsWith('https://top10lists.us') && !url.startsWith('https://www.top10lists.us')) {
      toast.error('URL must start with https://top10lists.us');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('warm-cache-single', {
        body: { url: url.trim() }
      });

      if (error) throw error;

      if (data.success) {
        setResult({ success: true, message: `Cache warmed: ${url}` });
        toast.success('Cache warmed successfully');
      } else {
        setResult({ success: false, message: data.error || 'Cache warming failed' });
        toast.error(data.error || 'Cache warming failed');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setResult({ success: false, message });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const quickUrls = [
    { label: 'Homepage', url: 'https://top10lists.us/' },
    { label: 'Scottsdale', url: 'https://top10lists.us/arizona/scottsdale/top10realestateagents' },
    { label: 'Phoenix', url: 'https://top10lists.us/arizona/phoenix/top10realestateagents' },
    { label: 'Mesa', url: 'https://top10lists.us/arizona/mesa/top10realestateagents' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="h-5 w-5" />
          Single Page Cache Warm
        </CardTitle>
        <CardDescription>
          Warm a specific page in the Cloudflare KV cache for faster bot/crawler responses
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://top10lists.us/arizona/scottsdale/top10realestateagents"
            className="flex-1"
          />
          <Button onClick={handleWarmCache} disabled={loading}>
            {loading ? (
              <>
                <Flame className="h-4 w-4 mr-2 animate-pulse" />
                Warming...
              </>
            ) : (
              <>
                <Flame className="h-4 w-4 mr-2" />
                Warm Cache
              </>
            )}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground">Quick:</span>
          {quickUrls.map((item) => (
            <Button
              key={item.url}
              variant="outline"
              size="sm"
              onClick={() => handleUrlChange(item.url)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        {result && (
          <div className={`flex items-center gap-2 p-3 rounded-md ${
            result.success ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200' : 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200'
          }`}>
            {result.success ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <span className="text-sm">{result.message}</span>
          </div>
        )}

        <div className="border-t pt-4 mt-4">
          <span className="text-sm text-muted-foreground block mb-2">Sitemaps:</span>
          <div className="flex flex-wrap gap-2">
            <a
              href="https://top10lists.us/sitemap.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Static Sitemap
            </a>
            <a
              href="https://bgdtekbhelormzbymkhh.supabase.co/functions/v1/generate-sitemap"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Dynamic Sitemap
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
