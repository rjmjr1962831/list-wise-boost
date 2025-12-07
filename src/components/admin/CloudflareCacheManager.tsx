import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Trash2, Database, Globe, Loader2 } from 'lucide-react';

export function CloudflareCacheManager() {
  const [prefix, setPrefix] = useState('');
  const [isPurgingCdn, setIsPurgingCdn] = useState(false);
  const [isClearingKv, setIsClearingKv] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [result, setResult] = useState<{ cdnPurged?: number; kvDeleted?: number; error?: string } | null>(null);

  const purgeCdnCache = async (urls?: string[]) => {
    const { data, error } = await supabase.functions.invoke('cloudflare-purge-cache', {
      body: urls ? { urls } : { purge_everything: true }
    });
    
    if (error) throw error;
    if (!data.success) throw new Error(data.error);
    return data;
  };

  const clearKvCache = async (prefixFilter?: string, clearAll?: boolean) => {
    const { data, error } = await supabase.functions.invoke('clear-kv-cache', {
      body: clearAll ? { clear_all: true } : { prefix: prefixFilter }
    });
    
    if (error) throw error;
    if (!data.success) throw new Error(data.error);
    return data;
  };

  const handleClearAll = async () => {
    if (!confirm('This will clear ALL CDN cache AND ALL KV cache. Are you sure?')) return;
    
    setIsClearingAll(true);
    setResult(null);
    
    try {
      // Step 1: Purge CDN cache
      toast.info('Step 1/2: Purging CDN cache...');
      await purgeCdnCache();
      
      // Step 2: Clear KV cache
      toast.info('Step 2/2: Clearing KV cache...');
      const kvResult = await clearKvCache(undefined, true);
      
      setResult({ cdnPurged: 1, kvDeleted: kvResult.deleted });
      toast.success(`Cache cleared! CDN purged, ${kvResult.deleted} KV keys deleted`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setResult({ error: message });
      toast.error(`Failed: ${message}`);
    } finally {
      setIsClearingAll(false);
    }
  };

  const handleClearByPrefix = async (prefixValue: string) => {
    setIsClearingKv(true);
    setResult(null);
    
    try {
      // Step 1: Purge specific URL from CDN
      toast.info('Step 1/2: Purging CDN cache...');
      await purgeCdnCache([prefixValue]);
      
      // Step 2: Clear KV keys with prefix
      toast.info('Step 2/2: Clearing KV cache...');
      const kvResult = await clearKvCache(prefixValue);
      
      setResult({ cdnPurged: 1, kvDeleted: kvResult.deleted });
      toast.success(`Cache cleared for ${prefixValue}: ${kvResult.deleted} KV keys deleted`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setResult({ error: message });
      toast.error(`Failed: ${message}`);
    } finally {
      setIsClearingKv(false);
    }
  };

  const handlePurgeCdnOnly = async () => {
    if (!prefix) {
      toast.error('Enter a URL to purge');
      return;
    }
    
    setIsPurgingCdn(true);
    setResult(null);
    
    try {
      await purgeCdnCache([prefix]);
      setResult({ cdnPurged: 1 });
      toast.success(`CDN cache purged for ${prefix}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setResult({ error: message });
      toast.error(`Failed: ${message}`);
    } finally {
      setIsPurgingCdn(false);
    }
  };

  const presetPrefixes = [
    { label: 'Arizona (all)', prefix: 'https://top10lists.us/arizona' },
    { label: 'Phoenix', prefix: 'https://top10lists.us/arizona/phoenix' },
    { label: 'Scottsdale', prefix: 'https://top10lists.us/arizona/scottsdale' },
    { label: 'Mesa', prefix: 'https://top10lists.us/arizona/mesa' },
    { label: 'Tempe', prefix: 'https://top10lists.us/arizona/tempe' },
    { label: 'Gilbert', prefix: 'https://top10lists.us/arizona/gilbert' },
  ];

  const isLoading = isPurgingCdn || isClearingKv || isClearingAll;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="h-5 w-5" />
          Cloudflare Cache Manager
        </CardTitle>
        <CardDescription>
          Purge CDN cache and clear KV prerender cache. Always purge before warming.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Clear All Section */}
        <div className="p-4 border border-destructive/30 rounded-lg bg-destructive/5">
          <h3 className="font-semibold text-destructive mb-2">Nuclear Option: Clear Everything</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Purges entire CDN cache AND deletes all KV prerender entries.
          </p>
          <Button 
            variant="destructive" 
            onClick={handleClearAll}
            disabled={isLoading}
          >
            {isClearingAll ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Clearing All...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All Caches
              </>
            )}
          </Button>
        </div>

        {/* Quick Presets */}
        <div>
          <h3 className="font-semibold mb-2">Quick Clear (CDN + KV)</h3>
          <div className="flex flex-wrap gap-2">
            {presetPrefixes.map(({ label, prefix: presetPrefix }) => (
              <Button
                key={presetPrefix}
                variant="outline"
                size="sm"
                onClick={() => handleClearByPrefix(presetPrefix)}
                disabled={isLoading}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Custom URL Input */}
        <div className="space-y-3">
          <h3 className="font-semibold">Custom URL/Prefix</h3>
          <div className="flex gap-2">
            <Input
              placeholder="https://top10lists.us/arizona/chandler"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => prefix && handleClearByPrefix(prefix)}
              disabled={isLoading || !prefix}
              className="flex-1"
            >
              <Database className="h-4 w-4 mr-2" />
              Clear CDN + KV
            </Button>
            <Button
              variant="secondary"
              onClick={handlePurgeCdnOnly}
              disabled={isLoading || !prefix}
            >
              <Globe className="h-4 w-4 mr-2" />
              CDN Only
            </Button>
          </div>
        </div>

        {/* Result Display */}
        {result && (
          <div className={`p-3 rounded-lg text-sm ${result.error ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-700'}`}>
            {result.error ? (
              <p>❌ Error: {result.error}</p>
            ) : (
              <div>
                <p>✅ Cache cleared successfully</p>
                {result.cdnPurged !== undefined && <p>• CDN: Purged</p>}
                {result.kvDeleted !== undefined && <p>• KV: {result.kvDeleted} keys deleted</p>}
              </div>
            )}
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>CDN Cache:</strong> Cloudflare edge cache (browser requests)</p>
          <p><strong>KV Cache:</strong> Prerendered HTML storage (bot/crawler requests)</p>
          <p><strong>Workflow:</strong> Clear cache → Wait 30s → Warm cache (if needed)</p>
        </div>
      </CardContent>
    </Card>
  );
}
