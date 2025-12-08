import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Trash2, Database, Globe, Loader2, Flame, RefreshCw, Square } from 'lucide-react';

interface ProgressState {
  step: number;
  totalSteps: number;
  message: string;
  percent: number;
}

interface WarmResult {
  total: number;
  warmed: number;
  failed: number;
  hasMore: boolean;
  nextOffset: number;
}

export function CloudflareCacheManager() {
  const [prefix, setPrefix] = useState('');
  const [isPurgingCdn, setIsPurgingCdn] = useState(false);
  const [isClearingKv, setIsClearingKv] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [isWarming, setIsWarming] = useState(false);
  const [isFullRefresh, setIsFullRefresh] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [result, setResult] = useState<{ cdnPurged?: number; kvDeleted?: number; warmResult?: WarmResult; error?: string } | null>(null);
  
  // Ref to track cancellation request
  const cancelRequestedRef = useRef(false);

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

  const warmCache = async (region?: string, limit?: number, offset?: number) => {
    const { data, error } = await supabase.functions.invoke('warm-cache', {
      body: { region, limit, offset }
    });
    
    if (error) throw error;
    if (!data.success && data.error) throw new Error(data.error);
    return data as WarmResult;
  };

  // Warm all pages in sequential batches
  const warmAllPages = async (region: string, batchSize: number = 10) => {
    let offset = 0;
    let totalWarmed = 0;
    let totalFailed = 0;
    let totalPages = 0;
    let batchNum = 1;
    let wasCancelled = false;

    while (true) {
      // Check for cancellation
      if (cancelRequestedRef.current) {
        wasCancelled = true;
        console.log('Warming cancelled by user');
        break;
      }

      setProgress({ 
        step: batchNum, 
        totalSteps: totalPages > 0 ? Math.ceil(totalPages / batchSize) : batchNum, 
        message: `Warming batch ${batchNum} (pages ${offset + 1}-${offset + batchSize})...`, 
        percent: totalPages > 0 ? Math.round((offset / totalPages) * 100) : 50 
      });

      const result = await warmCache(region, batchSize, offset);
      
      totalWarmed += result.warmed;
      totalFailed += result.failed;
      totalPages = result.total;
      
      console.log(`Batch ${batchNum}: ${result.warmed}/${batchSize} warmed, hasMore: ${result.hasMore}`);

      if (!result.hasMore) {
        break;
      }

      offset = result.nextOffset;
      batchNum++;
    }

    return { total: totalPages, warmed: totalWarmed, failed: totalFailed, cancelled: wasCancelled };
  };

  const handleCancel = () => {
    cancelRequestedRef.current = true;
    toast.info('Cancelling after current batch completes...');
  };

  // Full workflow: Purge → Clear KV → Warm
  const handleFullRefresh = async () => {
    if (!confirm('This will purge all caches and re-warm them. This may take several minutes. Continue?')) return;
    
    setIsFullRefresh(true);
    setResult(null);
    cancelRequestedRef.current = false;
    
    try {
      // Step 1: Purge CDN
      setProgress({ step: 1, totalSteps: 3, message: 'Purging CDN cache...', percent: 10 });
      await purgeCdnCache();
      
      // Step 2: Clear KV
      setProgress({ step: 2, totalSteps: 3, message: 'Clearing KV cache...', percent: 30 });
      const kvResult = await clearKvCache(undefined, true);
      
      // Step 3: Warm cache in batches
      setProgress({ step: 3, totalSteps: 3, message: 'Warming cache (running batches)...', percent: 50 });
      const warmResult = await warmAllPages('arizona', 10);
      
      setProgress({ step: 3, totalSteps: 3, message: warmResult.cancelled ? 'Cancelled!' : 'Complete!', percent: 100 });
      setResult({ cdnPurged: 1, kvDeleted: kvResult.deleted, warmResult: { ...warmResult, hasMore: false, nextOffset: 0 } });
      
      if (warmResult.cancelled) {
        toast.warning(`Warming cancelled. Warmed ${warmResult.warmed}/${warmResult.total} pages before stopping.`);
      } else {
        toast.success(`Full refresh complete! Warmed ${warmResult.warmed}/${warmResult.total} pages`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setResult({ error: message });
      toast.error(`Failed: ${message}`);
    } finally {
      setIsFullRefresh(false);
      cancelRequestedRef.current = false;
      setTimeout(() => setProgress(null), 3000);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('This will clear ALL CDN cache AND ALL KV cache. Are you sure?')) return;
    
    setIsClearingAll(true);
    setResult(null);
    setProgress({ step: 1, totalSteps: 2, message: 'Purging CDN cache...', percent: 25 });
    
    try {
      await purgeCdnCache();
      setProgress({ step: 2, totalSteps: 2, message: 'Clearing KV cache...', percent: 75 });
      
      const kvResult = await clearKvCache(undefined, true);
      
      setProgress({ step: 2, totalSteps: 2, message: 'Complete!', percent: 100 });
      setResult({ cdnPurged: 1, kvDeleted: kvResult.deleted });
      toast.success(`Cache cleared! CDN purged, ${kvResult.deleted} KV keys deleted`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setResult({ error: message });
      toast.error(`Failed: ${message}`);
    } finally {
      setIsClearingAll(false);
      setTimeout(() => setProgress(null), 2000);
    }
  };

  const handleWarmOnly = async (region: string, batchSize: number = 10) => {
    setIsWarming(true);
    setResult(null);
    cancelRequestedRef.current = false;
    setProgress({ step: 1, totalSteps: 1, message: 'Starting cache warming...', percent: 10 });
    
    try {
      const warmResult = await warmAllPages(region, batchSize);
      setProgress({ step: 1, totalSteps: 1, message: warmResult.cancelled ? 'Cancelled!' : 'Complete!', percent: 100 });
      setResult({ warmResult: { ...warmResult, hasMore: false, nextOffset: 0 } });
      
      if (warmResult.cancelled) {
        toast.warning(`Warming cancelled. Warmed ${warmResult.warmed}/${warmResult.total} pages before stopping.`);
      } else {
        toast.success(`Cache warmed: ${warmResult.warmed}/${warmResult.total} pages`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setResult({ error: message });
      toast.error(`Failed: ${message}`);
    } finally {
      setIsWarming(false);
      cancelRequestedRef.current = false;
      setTimeout(() => setProgress(null), 2000);
    }
  };

  const handleClearByPrefix = async (prefixValue: string) => {
    setIsClearingKv(true);
    setResult(null);
    setProgress({ step: 1, totalSteps: 2, message: 'Purging CDN cache...', percent: 25 });
    
    try {
      await purgeCdnCache([prefixValue]);
      setProgress({ step: 2, totalSteps: 2, message: 'Clearing KV cache...', percent: 75 });
      
      const kvResult = await clearKvCache(prefixValue);
      
      setProgress({ step: 2, totalSteps: 2, message: 'Complete!', percent: 100 });
      setResult({ cdnPurged: 1, kvDeleted: kvResult.deleted });
      toast.success(`Cache cleared for ${prefixValue}: ${kvResult.deleted} KV keys deleted`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setResult({ error: message });
      toast.error(`Failed: ${message}`);
    } finally {
      setIsClearingKv(false);
      setTimeout(() => setProgress(null), 2000);
    }
  };

  const handlePurgeCdnOnly = async () => {
    if (!prefix) {
      toast.error('Enter a URL to purge');
      return;
    }
    
    setIsPurgingCdn(true);
    setResult(null);
    setProgress({ step: 1, totalSteps: 1, message: 'Purging CDN cache...', percent: 50 });
    
    try {
      await purgeCdnCache([prefix]);
      setProgress({ step: 1, totalSteps: 1, message: 'Complete!', percent: 100 });
      setResult({ cdnPurged: 1 });
      toast.success(`CDN cache purged for ${prefix}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setResult({ error: message });
      toast.error(`Failed: ${message}`);
    } finally {
      setIsPurgingCdn(false);
      setTimeout(() => setProgress(null), 2000);
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

  const isLoading = isPurgingCdn || isClearingKv || isClearingAll || isWarming || isFullRefresh;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="h-5 w-5" />
          Cloudflare Cache Manager
        </CardTitle>
        <CardDescription>
          Purge CDN cache, clear KV prerender cache, and warm cache for bots.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Full Refresh Section */}
        <div className="p-4 border border-primary/30 rounded-lg bg-primary/5">
          <h3 className="font-semibold text-primary mb-2 flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Full Cache Refresh (Recommended)
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            Purges CDN → Clears KV → Warms all Arizona pages. Takes 5-10 minutes.
          </p>
          <Button 
            onClick={handleFullRefresh}
            disabled={isLoading}
          >
            {isFullRefresh ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running Full Refresh...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Full Cache Refresh
              </>
            )}
          </Button>
        </div>

        {/* Warm Only Section */}
        <div className="p-4 border border-orange-500/30 rounded-lg bg-orange-500/5">
          <h3 className="font-semibold text-orange-600 mb-2 flex items-center gap-2">
            <Flame className="h-4 w-4" />
            Warm Cache Only
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            Pre-render pages without clearing existing cache.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline"
              onClick={() => handleWarmOnly('arizona', 10)}
              disabled={isLoading}
            >
              {isWarming ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Flame className="h-4 w-4 mr-2" />}
              Warm All (10/batch)
            </Button>
            <Button 
              variant="outline"
              onClick={() => handleWarmOnly('arizona', 5)}
              disabled={isLoading}
            >
              Warm All (5/batch)
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Runs sequential batches automatically until all pages are warmed.
          </p>
        </div>

        {/* Clear All Section */}
        <div className="p-4 border border-destructive/30 rounded-lg bg-destructive/5">
          <h3 className="font-semibold text-destructive mb-2">Clear Caches Only (No Warm)</h3>
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

        {/* Progress Bar */}
        {progress && (
          <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{progress.message}</span>
              <span className="text-muted-foreground">Step {progress.step}/{progress.totalSteps}</span>
            </div>
            <Progress value={progress.percent} className="h-2" />
            {(isWarming || isFullRefresh) && (
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleCancel}
                className="mt-2"
              >
                <Square className="h-3 w-3 mr-2" />
                Stop Warming
              </Button>
            )}
          </div>
        )}

        {/* Result Display */}
        {result && (
          <div className={`p-3 rounded-lg text-sm ${result.error ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-700'}`}>
            {result.error ? (
              <p>❌ Error: {result.error}</p>
            ) : (
              <div>
                <p>✅ Operation completed successfully</p>
                {result.cdnPurged !== undefined && <p>• CDN: Purged</p>}
                {result.kvDeleted !== undefined && <p>• KV: {result.kvDeleted} keys deleted</p>}
                {result.warmResult && (
                  <p>• Warmed: {result.warmResult.warmed}/{result.warmResult.total} pages ({result.warmResult.failed} failed)</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>CDN Cache:</strong> Cloudflare edge cache (browser requests)</p>
          <p><strong>KV Cache:</strong> Prerendered HTML storage (bot/crawler requests)</p>
          <p><strong>Warm:</strong> Pre-render pages via Prerender.io and cache in KV</p>
        </div>
      </CardContent>
    </Card>
  );
}