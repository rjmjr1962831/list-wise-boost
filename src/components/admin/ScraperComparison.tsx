import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Zap, Clock, DollarSign, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';

interface ScraperResult {
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
  method: string;
}

export const ScraperComparison = () => {
  const [zillowUrl, setZillowUrl] = useState('https://www.zillow.com/profile/rmaynard001');
  const [websiteUrl, setWebsiteUrl] = useState('https://www.laughtonteam.com');
  const [loading, setLoading] = useState<'firecrawl' | 'memo23' | 'both' | null>(null);
  const [firecrawlResult, setFirecrawlResult] = useState<ScraperResult | null>(null);
  const [memo23Result, setMemo23Result] = useState<ScraperResult | null>(null);
  const [websiteFirecrawlResult, setWebsiteFirecrawlResult] = useState<ScraperResult | null>(null);
  const [websiteScrapeHtmlResult, setWebsiteScrapeHtmlResult] = useState<ScraperResult | null>(null);

  const testFirecrawlZillow = async () => {
    setLoading('firecrawl');
    const startTime = Date.now();
    
    try {
      const { data, error } = await supabase.functions.invoke('fetch-zillow-agent-firecrawl', {
        body: { profileUrl: zillowUrl }
      });

      const duration = Date.now() - startTime;

      if (error) throw error;

      setFirecrawlResult({
        success: data.success,
        data: data.data,
        error: data.error,
        duration,
        method: 'firecrawl'
      });

      if (data.success) {
        toast.success(`Firecrawl completed in ${(duration / 1000).toFixed(2)}s`);
      } else {
        toast.error(`Firecrawl failed: ${data.error}`);
      }
    } catch (error: any) {
      setFirecrawlResult({
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
        method: 'firecrawl'
      });
      toast.error(`Firecrawl error: ${error.message}`);
    } finally {
      setLoading(null);
    }
  };

  const testMemo23Zillow = async () => {
    setLoading('memo23');
    const startTime = Date.now();
    
    try {
      const { data, error } = await supabase.functions.invoke('fetch-single-memo23-agent', {
        body: { profileUrl: zillowUrl }
      });

      const duration = Date.now() - startTime;

      if (error) throw error;

      setMemo23Result({
        success: data.success !== false,
        data: data.data || data,
        error: data.error,
        duration,
        method: 'memo23'
      });

      if (data.success !== false) {
        toast.success(`Memo23 completed in ${(duration / 1000).toFixed(2)}s`);
      } else {
        toast.error(`Memo23 failed: ${data.error}`);
      }
    } catch (error: any) {
      setMemo23Result({
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
        method: 'memo23'
      });
      toast.error(`Memo23 error: ${error.message}`);
    } finally {
      setLoading(null);
    }
  };

  const testBothZillow = async () => {
    setLoading('both');
    await Promise.all([testFirecrawlZillow(), testMemo23Zillow()]);
    setLoading(null);
  };

  const testFirecrawlWebsite = async () => {
    setLoading('firecrawl');
    const startTime = Date.now();
    
    try {
      const { data, error } = await supabase.functions.invoke('scrape-website-firecrawl', {
        body: { url: websiteUrl, includeAboutPage: true }
      });

      const duration = Date.now() - startTime;

      if (error) throw error;

      setWebsiteFirecrawlResult({
        success: data.success,
        data: data,
        error: data.error,
        duration,
        method: 'firecrawl'
      });

      if (data.success) {
        toast.success(`Website scraped in ${(duration / 1000).toFixed(2)}s`);
      }
    } catch (error: any) {
      setWebsiteFirecrawlResult({
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
        method: 'firecrawl'
      });
    } finally {
      setLoading(null);
    }
  };

  const testScrapeHtmlWebsite = async () => {
    setLoading('memo23');
    const startTime = Date.now();
    
    try {
      const { data, error } = await supabase.functions.invoke('scrape-html', {
        body: { url: websiteUrl }
      });

      const duration = Date.now() - startTime;

      if (error) throw error;

      setWebsiteScrapeHtmlResult({
        success: !!data.html,
        data: data,
        error: data.error,
        duration,
        method: 'scrape-html'
      });

      if (data.html) {
        toast.success(`HTML scraped in ${(duration / 1000).toFixed(2)}s`);
      }
    } catch (error: any) {
      setWebsiteScrapeHtmlResult({
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
        method: 'scrape-html'
      });
    } finally {
      setLoading(null);
    }
  };

  const renderResultCard = (result: ScraperResult | null, title: string) => {
    if (!result) return null;

    return (
      <Card className={result.success ? 'border-green-500' : 'border-destructive'}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              {result.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              {title}
            </CardTitle>
            <div className="flex gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {(result.duration / 1000).toFixed(2)}s
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {result.success && result.data && (
            <ScrollArea className="h-64">
              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            </ScrollArea>
          )}
          {!result.success && (
            <div className="text-destructive text-sm">{result.error}</div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderComparison = () => {
    if (!firecrawlResult && !memo23Result) return null;

    const speedImprovement = firecrawlResult && memo23Result
      ? ((memo23Result.duration - firecrawlResult.duration) / memo23Result.duration * 100).toFixed(0)
      : null;

    return (
      <Card className="mt-4 bg-muted/50">
        <CardHeader>
          <CardTitle className="text-lg">Comparison Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">
                {firecrawlResult ? (firecrawlResult.duration / 1000).toFixed(2) : '-'}s
              </div>
              <div className="text-sm text-muted-foreground">Firecrawl</div>
            </div>
            <div className="flex items-center justify-center">
              {speedImprovement && parseInt(speedImprovement) > 0 && (
                <Badge className="bg-green-500">
                  {speedImprovement}% faster
                </Badge>
              )}
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-500">
                {memo23Result ? (memo23Result.duration / 1000).toFixed(2) : '-'}s
              </div>
              <div className="text-sm text-muted-foreground">Memo23</div>
            </div>
          </div>

          {firecrawlResult?.data && memo23Result?.data && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Firecrawl Data Points</h4>
                <ul className="text-sm space-y-1">
                  <li>Name: {firecrawlResult.data.name || 'N/A'}</li>
                  <li>Rating: {firecrawlResult.data.ratingsAverage || 'N/A'}</li>
                  <li>Reviews: {firecrawlResult.data.ratingsCount || 'N/A'}</li>
                  <li>Sales: {firecrawlResult.data.totalSales || 'N/A'}</li>
                  <li>Bio: {firecrawlResult.data.bio ? `${firecrawlResult.data.bio.substring(0, 50)}...` : 'N/A'}</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Memo23 Data Points</h4>
                <ul className="text-sm space-y-1">
                  <li>Name: {memo23Result.data?.fullName || memo23Result.data?.name || 'N/A'}</li>
                  <li>Rating: {memo23Result.data?.reviewStarsRating || 'N/A'}</li>
                  <li>Reviews: {memo23Result.data?.numTotalReviews || 'N/A'}</li>
                  <li>Sales: {memo23Result.data?.agentSalesStats?.countAllTime || 'N/A'}</li>
                  <li>Bio: {memo23Result.data?.getToKnowMe ? `${memo23Result.data.getToKnowMe.substring(0, 50)}...` : 'N/A'}</li>
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Scraper Comparison Tool
        </CardTitle>
        <CardDescription>
          Compare Firecrawl vs current scrapers (memo23/scrape-html) side-by-side
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="zillow">
          <TabsList className="mb-4">
            <TabsTrigger value="zillow">Zillow Profile Scraping</TabsTrigger>
            <TabsTrigger value="website">Website Scraping</TabsTrigger>
          </TabsList>

          <TabsContent value="zillow" className="space-y-4">
            <div className="space-y-2">
              <Label>Zillow Profile URL</Label>
              <Input
                value={zillowUrl}
                onChange={(e) => setZillowUrl(e.target.value)}
                placeholder="https://www.zillow.com/profile/..."
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={testFirecrawlZillow}
                disabled={!!loading}
                variant="default"
              >
                {loading === 'firecrawl' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="mr-2 h-4 w-4" />
                )}
                Test Firecrawl
              </Button>
              <Button
                onClick={testMemo23Zillow}
                disabled={!!loading}
                variant="outline"
              >
                {loading === 'memo23' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Test Memo23
              </Button>
              <Button
                onClick={testBothZillow}
                disabled={!!loading}
                variant="secondary"
              >
                {loading === 'both' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                Test Both
              </Button>
            </div>

            {renderComparison()}

            <div className="grid grid-cols-2 gap-4 mt-4">
              {renderResultCard(firecrawlResult, 'Firecrawl Result')}
              {renderResultCard(memo23Result, 'Memo23 Result')}
            </div>
          </TabsContent>

          <TabsContent value="website" className="space-y-4">
            <div className="space-y-2">
              <Label>Agent Website URL</Label>
              <Input
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://www.example.com"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={testFirecrawlWebsite}
                disabled={!!loading}
                variant="default"
              >
                {loading === 'firecrawl' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="mr-2 h-4 w-4" />
                )}
                Test Firecrawl (Markdown)
              </Button>
              <Button
                onClick={testScrapeHtmlWebsite}
                disabled={!!loading}
                variant="outline"
              >
                {loading === 'memo23' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Test scrape-html (Raw HTML)
              </Button>
            </div>

            {websiteFirecrawlResult && websiteScrapeHtmlResult && (
              <Card className="mt-4 bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-lg">Token Savings Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">
                        ~{websiteFirecrawlResult.data?.data?.estimatedTokens || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">Firecrawl tokens (markdown)</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-500">
                        ~{websiteScrapeHtmlResult.data?.html ? Math.ceil(websiteScrapeHtmlResult.data.html.length / 4) : 0}
                      </div>
                      <div className="text-sm text-muted-foreground">scrape-html tokens (raw HTML)</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-4 mt-4">
              {renderResultCard(websiteFirecrawlResult, 'Firecrawl Result')}
              {renderResultCard(websiteScrapeHtmlResult, 'scrape-html Result')}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};