import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Cloud, CheckCircle2, XCircle, ExternalLink, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function CloudflareCachePurge() {
  const [url, setUrl] = useState('https://top10lists.us/');
  const [loading, setLoading] = useState(false);
  const [purgeAllLoading, setPurgeAllLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    setResult(null);
  };

  const handlePurgeSingle = async () => {
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
      const { data, error } = await supabase.functions.invoke('cloudflare-purge-cache', {
        body: { urls: [url.trim()] }
      });

      if (error) throw error;

      if (data.success) {
        setResult({ success: true, message: `Cache purged: ${url}` });
        toast.success('Cache purged successfully');
      } else {
        setResult({ success: false, message: data.error || 'Purge failed' });
        toast.error(data.error || 'Purge failed');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setResult({ success: false, message });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handlePurgeAll = async () => {
    if (!confirm('Are you sure you want to purge the ENTIRE Cloudflare cache? This will affect all cached content.')) {
      return;
    }

    setPurgeAllLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('cloudflare-purge-cache', {
        body: { purge_everything: true }
      });

      if (error) throw error;

      if (data.success) {
        setResult({ success: true, message: 'Entire cache purged successfully' });
        toast.success('Entire cache purged');
      } else {
        setResult({ success: false, message: data.error || 'Purge failed' });
        toast.error(data.error || 'Purge failed');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setResult({ success: false, message });
      toast.error(message);
    } finally {
      setPurgeAllLoading(false);
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
          <Cloud className="h-5 w-5" />
          Cloudflare Cache Purge
        </CardTitle>
        <CardDescription>
          Purge cached pages from Cloudflare to force fresh content for bots and users
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
          <Button onClick={handlePurgeSingle} disabled={loading || purgeAllLoading}>
            {loading ? (
              <>
                <Cloud className="h-4 w-4 mr-2 animate-pulse" />
                Purging...
              </>
            ) : (
              <>
                <Cloud className="h-4 w-4 mr-2" />
                Purge URL
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

        <div className="border-t pt-4">
          <Button 
            variant="destructive" 
            onClick={handlePurgeAll} 
            disabled={loading || purgeAllLoading}
            className="w-full"
          >
            {purgeAllLoading ? (
              <>
                <Trash2 className="h-4 w-4 mr-2 animate-pulse" />
                Purging Entire Cache...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Purge Entire Cache
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            ⚠️ This will purge ALL cached content across the entire site
          </p>
        </div>

        {result && (
          <div className={`flex items-center gap-2 p-3 rounded-md ${
            result.success 
              ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200' 
              : 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200'
          }`}>
            {result.success ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <span className="text-sm">{result.message}</span>
          </div>
        )}

        <div className="border-t pt-4">
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
