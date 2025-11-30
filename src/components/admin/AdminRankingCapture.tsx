import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Target, MapPin, Building2, CheckCircle2, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CityResult {
  city: string;
  status: 'success' | 'failed';
  updated?: number;
  notFound?: number;
  error?: string;
}

export function AdminRankingCapture() {
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{
    current: number;
    total: number;
    currentCity: string;
  } | null>(null);
  const [liveResults, setLiveResults] = useState<CityResult[]>([]);
  const [city, setCity] = useState("");
  const { toast } = useToast();

  const handleCapture = async (cityName: string) => {
    if (!cityName.trim()) {
      toast({
        title: "Missing city",
        description: "Please enter a city name",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("capture-zillow-rankings", {
        body: { cityName: cityName.trim() },
      });

      if (error) throw error;

      toast({
        title: "✅ Ranking capture complete",
        description: `Updated ${data.stats.updated} agents, ${data.stats.notFound} not found in database`,
      });
      
      setCity("");
    } catch (error: any) {
      console.error("Ranking capture error:", error);
      toast({
        title: "Capture failed",
        description: error.message || "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkCapture = async () => {
    setBulkLoading(true);
    setBulkProgress({ current: 0, total: 17, currentCity: "Starting..." });
    setLiveResults([]);
    
    try {
      console.log('🚀 Starting bulk capture...');
      
      // Start the bulk capture
      const { data: startData, error: startError } = await supabase.functions.invoke(
        'bulk-capture-phoenix-rankings',
        { method: 'POST' }
      );

      if (startError) throw startError;

      const sessionId = startData.sessionId;
      console.log('✅ Bulk capture started with session:', sessionId);

      toast({
        title: "Bulk capture started",
        description: "Processing 17 Phoenix metro cities...",
      });

      // Poll for progress every 2 seconds
      const pollInterval = setInterval(async () => {
        try {
          const { data: progressData, error: progressError } = await supabase.functions.invoke(
            `bulk-capture-phoenix-rankings?sessionId=${sessionId}`,
            { method: 'GET' }
          );

          if (progressError) {
            console.error('Error polling progress:', progressError);
            return;
          }

          console.log('📊 Progress update:', progressData);

          // Update UI with current progress
          setBulkProgress({
            current: progressData.current_index + 1,
            total: progressData.total_cities,
            currentCity: progressData.current_city || 'Processing...'
          });

          // Update results
          if (progressData.results && Array.isArray(progressData.results)) {
            setLiveResults(progressData.results.map((r: any) => ({
              city: r.city,
              status: r.status,
              updated: r.updated,
              notFound: r.notFound,
              error: r.error
            })));
          }

          // Check if completed
          if (progressData.status === 'completed') {
            clearInterval(pollInterval);
            
            const totalUpdated = progressData.results.reduce((sum: number, r: any) => 
              sum + (r.updated || 0), 0
            );
            const totalFailed = progressData.results.filter((r: any) => 
              r.status === 'failed'
            ).length;

            toast({
              title: "✅ Bulk capture complete!",
              description: `Updated ${totalUpdated} agents across ${progressData.total_cities} cities. ${totalFailed} cities failed.`,
            });
            
            setBulkProgress(null);
            setBulkLoading(false);
          }

        } catch (pollError) {
          console.error('Polling error:', pollError);
        }
      }, 2000); // Poll every 2 seconds

      // Safety timeout after 10 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (bulkLoading) {
          toast({
            title: "Process timeout",
            description: "Bulk capture may still be running. Check logs for details.",
            variant: "destructive",
          });
          setBulkLoading(false);
          setBulkProgress(null);
        }
      }, 600000); // 10 minutes

    } catch (error: any) {
      console.error("Bulk capture error:", error);
      toast({
        title: "Failed to start bulk capture",
        description: error.message || "Unknown error occurred",
        variant: "destructive",
      });
      setBulkProgress(null);
      setBulkLoading(false);
    }
  };

  const quickCities = [
    "Phoenix, AZ",
    "Scottsdale, AZ",
    "Gilbert, AZ",
    "Mesa, AZ",
    "Chandler, AZ",
    "Tempe, AZ",
    "Glendale, AZ",
    "Peoria, AZ",
    "Surprise, AZ",
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Capture Zillow Rankings
          </CardTitle>
          <CardDescription>
            Update search page and position for existing agents in the database
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Bulk Phoenix Metro Capture */}
          <div className="space-y-3 p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-semibold">Phoenix Metro Bulk Capture</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Capture rankings for all 17 Phoenix metro area cities
                </p>
              </div>
              <Button
                onClick={handleBulkCapture}
                disabled={bulkLoading || loading}
                size="lg"
                className="gap-2"
              >
                {bulkLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Building2 className="h-4 w-4" />
                    Run Phoenix Metro
                  </>
                )}
              </Button>
            </div>
            
            {bulkProgress && (
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Processing: {bulkProgress.currentCity}</span>
                  <span>{bulkProgress.current} / {bulkProgress.total}</span>
                </div>
                <Progress value={(bulkProgress.current / bulkProgress.total) * 100} />
              </div>
            )}
          </div>

          {/* Live Results Log */}
          {(liveResults.length > 0 || bulkLoading) && (
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Live Results</Label>
                <span className="text-sm text-muted-foreground">
                  {liveResults.length} / {bulkProgress?.total || 17} completed
                </span>
              </div>
              
              <ScrollArea className="h-[300px] w-full rounded-md border bg-background p-4">
                <div className="space-y-2">
                  {liveResults.map((result, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {result.status === 'success' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                        )}
                        <div>
                          <p className="font-medium">{result.city}</p>
                          {result.status === 'success' ? (
                            <p className="text-sm text-muted-foreground">
                              {result.updated} updated, {result.notFound} not found
                            </p>
                          ) : (
                            <p className="text-sm text-red-600">
                              {result.error || 'Failed to capture'}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          result.status === 'success' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {result.status}
                        </span>
                      </div>
                    </div>
                  ))}
                  
                  {liveResults.length === 0 && bulkLoading && (
                    <div className="text-center text-muted-foreground py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      <p className="text-sm">Waiting for results...</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Quick City Buttons */}
          <div>
            <Label className="mb-3 block">Quick Capture Arizona Cities</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {quickCities.map((cityName) => (
                <Button
                  key={cityName}
                  variant="outline"
                  size="sm"
                  onClick={() => handleCapture(cityName)}
                  disabled={loading}
                  className="justify-start"
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  {cityName}
                </Button>
              ))}
            </div>
          </div>

          {/* Manual City Input */}
          <div className="space-y-3 pt-4 border-t">
            <Label htmlFor="city-input">Manual City Capture</Label>
            <div className="flex gap-2">
              <Input
                id="city-input"
                placeholder="e.g., Surprise, AZ"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading) {
                    handleCapture(city);
                  }
                }}
                disabled={loading}
              />
              <Button
                onClick={() => handleCapture(city)}
                disabled={loading || !city.trim()}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Capture
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
