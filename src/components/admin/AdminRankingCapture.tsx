import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Target, MapPin } from "lucide-react";

export function AdminRankingCapture() {
  const [loading, setLoading] = useState(false);
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
