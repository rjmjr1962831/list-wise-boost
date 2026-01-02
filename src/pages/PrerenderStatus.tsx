import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, CheckCircle, XCircle, AlertTriangle, Bot, Globe, Loader2 } from "lucide-react";
import { Helmet } from "react-helmet-async";

interface CacheStatus {
  url: string;
  fullUrl: string;
  cached: boolean;
  lastCachedAt: string | null;
  cacheAgeHours: number | null;
  error?: string;
}

interface BotTestResult {
  url: string;
  fullUrl: string;
  responseSize: number;
  responseSizeKB: number;
  hasJsonLd: boolean;
  hasAgentData: boolean;
  agentNamesFound: string[];
  isHealthy: boolean;
  error?: string;
  responsePreview?: string;
}

const PrerenderStatus = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [cacheResults, setCacheResults] = useState<CacheStatus[]>([]);
  const [botResults, setBotResults] = useState<BotTestResult[]>([]);
  const [isCheckingCache, setIsCheckingCache] = useState(false);
  const [isTestingBot, setIsTestingBot] = useState(false);
  const [recachingUrls, setRecachingUrls] = useState<Set<string>>(new Set());
  const [isRecachingAll, setIsRecachingAll] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/admin/login");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (!roles || !roles.some(r => r.role === "admin")) {
        toast.error("You don't have admin access");
        navigate("/");
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      console.error("Error checking admin access:", error);
      navigate("/admin/login");
    } finally {
      setIsLoading(false);
    }
  };

  const checkCacheStatus = async () => {
    setIsCheckingCache(true);
    try {
      const { data, error } = await supabase.functions.invoke('prerender-diagnostics', {
        body: { action: 'check' }
      });

      if (error) throw error;
      setCacheResults(data.results || []);
      toast.success(`Checked ${data.results?.length || 0} URLs`);
    } catch (err: any) {
      console.error('Cache check error:', err);
      toast.error(`Failed to check cache: ${err.message}`);
    } finally {
      setIsCheckingCache(false);
    }
  };

  const runBotTest = async () => {
    setIsTestingBot(true);
    try {
      const { data, error } = await supabase.functions.invoke('prerender-diagnostics', {
        body: { action: 'bot-test' }
      });

      if (error) throw error;
      setBotResults(data.results || []);
      
      const healthy = data.healthy || 0;
      const unhealthy = data.unhealthy || 0;
      
      if (unhealthy > 0) {
        toast.error(`${unhealthy} URLs are NOT healthy for AI crawlers!`);
      } else {
        toast.success(`All ${healthy} URLs are healthy for AI crawlers`);
      }
    } catch (err: any) {
      console.error('Bot test error:', err);
      toast.error(`Failed to run bot test: ${err.message}`);
    } finally {
      setIsTestingBot(false);
    }
  };

  const recacheUrl = async (url: string) => {
    setRecachingUrls(prev => new Set(prev).add(url));
    try {
      const { data, error } = await supabase.functions.invoke('prerender-diagnostics', {
        body: { action: 'recache', urls: [url] }
      });

      if (error) throw error;
      
      if (data.succeeded > 0) {
        toast.success(`Triggered recache for ${url}`);
      } else {
        toast.error(`Failed to recache ${url}`);
      }
    } catch (err: any) {
      console.error('Recache error:', err);
      toast.error(`Failed to recache: ${err.message}`);
    } finally {
      setRecachingUrls(prev => {
        const next = new Set(prev);
        next.delete(url);
        return next;
      });
    }
  };

  const recacheAll = async () => {
    setIsRecachingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke('prerender-diagnostics', {
        body: { action: 'recache-all' }
      });

      if (error) throw error;
      toast.success(`Triggered recache for ${data.succeeded} URLs`);
    } catch (err: any) {
      console.error('Recache all error:', err);
      toast.error(`Failed to recache all: ${err.message}`);
    } finally {
      setIsRecachingAll(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <Helmet>
        <title>Prerender Diagnostics | Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-b from-background to-muted">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin
            </Button>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Prerender Cache Diagnostics</h1>
            <p className="text-muted-foreground">
              Check if AI crawlers (GPTBot, ClaudeBot, PerplexityBot) receive fully rendered HTML with agent data.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4 mb-8">
            <Button 
              onClick={checkCacheStatus} 
              disabled={isCheckingCache}
              variant="outline"
            >
              {isCheckingCache ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Globe className="h-4 w-4 mr-2" />
              )}
              Check Cache Status
            </Button>
            
            <Button 
              onClick={runBotTest} 
              disabled={isTestingBot}
              variant="default"
            >
              {isTestingBot ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Bot className="h-4 w-4 mr-2" />
              )}
              Run Bot Test (GPTBot)
            </Button>
            
            <Button 
              onClick={recacheAll} 
              disabled={isRecachingAll}
              variant="secondary"
            >
              {isRecachingAll ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Recache All Cities
            </Button>
          </div>

          {/* Bot Test Results - Most Important */}
          {botResults.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  AI Crawler Test Results
                </CardTitle>
                <CardDescription>
                  Shows what GPTBot/ClaudeBot/PerplexityBot actually receive when crawling your pages
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {botResults.map((result, idx) => (
                    <div 
                      key={idx} 
                      className={`p-4 rounded-lg border ${
                        result.isHealthy ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {result.isHealthy ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-600" />
                            )}
                            <span className="font-mono text-sm">{result.url}</span>
                            <Badge variant={result.isHealthy ? "default" : "destructive"}>
                              {result.isHealthy ? 'HEALTHY' : 'BROKEN'}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Response Size:</span>
                              <div className={`font-semibold ${result.responseSizeKB >= 60 ? 'text-green-600' : 'text-red-600'}`}>
                                {result.responseSizeKB} KB
                                {result.responseSizeKB < 60 && (
                                  <span className="text-xs ml-1">(should be 60KB+)</span>
                                )}
                              </div>
                            </div>
                            
                            <div>
                              <span className="text-muted-foreground">JSON-LD Schema:</span>
                              <div className={`font-semibold ${result.hasJsonLd ? 'text-green-600' : 'text-amber-600'}`}>
                                {result.hasJsonLd ? '✓ Present' : '✗ Missing'}
                              </div>
                            </div>
                            
                            <div>
                              <span className="text-muted-foreground">Agent Data:</span>
                              <div className={`font-semibold ${result.hasAgentData ? 'text-green-600' : 'text-red-600'}`}>
                                {result.hasAgentData ? '✓ Found' : '✗ Empty/Shell'}
                              </div>
                            </div>
                            
                            <div>
                              <span className="text-muted-foreground">Agents Found:</span>
                              <div className="font-semibold">
                                {result.agentNamesFound.length > 0 
                                  ? result.agentNamesFound.slice(0, 3).join(', ')
                                  : 'None detected'}
                              </div>
                            </div>
                          </div>
                          
                          {result.error && (
                            <div className="mt-2 text-red-600 text-sm">
                              Error: {result.error}
                            </div>
                          )}
                          
                          {!result.isHealthy && !result.error && (
                            <div className="mt-2 p-2 bg-red-100 rounded text-sm text-red-800">
                              <AlertTriangle className="h-4 w-4 inline mr-1" />
                              <strong>GEO Issue:</strong> AI crawlers are receiving the empty React shell instead of rendered content.
                              Try recaching this URL.
                            </div>
                          )}
                        </div>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => recacheUrl(result.url)}
                          disabled={recachingUrls.has(result.url)}
                        >
                          {recachingUrls.has(result.url) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cache Status Results */}
          {cacheResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Prerender.io Cache Status
                </CardTitle>
                <CardDescription>
                  Shows whether pages are cached in prerender.io and when they were last cached
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {cacheResults.map((result, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        {result.cached ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-amber-600" />
                        )}
                        <div>
                          <div className="font-mono text-sm">{result.url}</div>
                          <div className="text-sm text-muted-foreground">
                            {result.cached ? (
                              <>
                                Cached {result.cacheAgeHours !== null && (
                                  <span className={result.cacheAgeHours > 24 ? 'text-amber-600' : ''}>
                                    {result.cacheAgeHours}h ago
                                  </span>
                                )}
                                {result.lastCachedAt && (
                                  <span className="ml-2">({new Date(result.lastCachedAt).toLocaleString()})</span>
                                )}
                              </>
                            ) : (
                              result.error || 'Not cached'
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => recacheUrl(result.url)}
                        disabled={recachingUrls.has(result.url)}
                      >
                        {recachingUrls.has(result.url) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Recache
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Help Text */}
          {cacheResults.length === 0 && botResults.length === 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Run a diagnostic test</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Click "Run Bot Test" to check if AI crawlers (GPTBot, ClaudeBot, PerplexityBot) 
                    receive fully rendered HTML with agent data, or just the empty React shell.
                  </p>
                  <p className="text-muted-foreground max-w-md mx-auto mt-2">
                    <strong>If they get the shell (small response, no agent data), your GEO is broken.</strong>
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
};

export default PrerenderStatus;
