import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Target, MapPin, Building2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export function AdminRankingCapture() {
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{
    current: number;
    total: number;
    currentCity: string;
  } | null>(null);
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
    setBulkProgress({ current: 0, total: 17, currentCity: "Connecting..." });
    
    try {
      // Get the WebSocket URL
      const projectRef = 'bgdtekbhelormzbymkhh';
      const wsUrl = `wss://${projectRef}.supabase.co/functions/v1/bulk-capture-phoenix-rankings`;
      
      console.log('Connecting to WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setBulkProgress({ current: 0, total: 17, currentCity: "Starting capture..." });
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('📨 WebSocket message:', message);

        if (message.type === 'started') {
          setBulkProgress({ 
            current: 0, 
            total: message.totalCities, 
            currentCity: "Processing cities..." 
          });
        } else if (message.type === 'progress') {
          setBulkProgress({
            current: message.current,
            total: message.total,
            currentCity: `Processing ${message.currentCity}...`
          });
        } else if (message.type === 'city_complete') {
          console.log(`✅ ${message.city}: ${message.status}`);
        } else if (message.type === 'complete') {
          toast({
            title: "✅ Bulk capture complete!",
            description: `Updated ${message.summary.totalUpdated} agents across ${message.summary.totalCities} cities. ${message.summary.totalFailed} cities failed.`,
          });
          setBulkProgress(null);
          setBulkLoading(false);
          ws.close();
        } else if (message.type === 'error') {
          toast({
            title: "Bulk capture failed",
            description: message.error,
            variant: "destructive",
          });
          setBulkProgress(null);
          setBulkLoading(false);
          ws.close();
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        toast({
          title: "Connection failed",
          description: "Failed to connect to ranking capture service",
          variant: "destructive",
        });
        setBulkProgress(null);
        setBulkLoading(false);
      };

      ws.onclose = () => {
        console.log('WebSocket connection closed');
        setBulkLoading(false);
      };

    } catch (error: any) {
      console.error("Bulk capture error:", error);
      toast({
        title: "Bulk capture failed",
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
