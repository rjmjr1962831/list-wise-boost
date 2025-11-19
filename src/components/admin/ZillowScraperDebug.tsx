import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bug, Play } from "lucide-react";

export const ZillowScraperDebug = () => {
  const [city, setCity] = useState("Fresno");
  const [state, setState] = useState("CA");
  const [maxAgents, setMaxAgents] = useState(10);
  const [loading, setLoading] = useState(false);
  const [requestPayload, setRequestPayload] = useState<any>(null);
  const [responseData, setResponseData] = useState<any>(null);

  const testScraper = async () => {
    setLoading(true);
    setRequestPayload(null);
    setResponseData(null);

    try {
      // Get city and category IDs (using real estate agents category)
      // Convert state abbreviation to full name for DB lookup
      const stateMap: Record<string, string> = {
        'CA': 'California',
        'AZ': 'Arizona',
        'TX': 'Texas',
        'FL': 'Florida',
        'NY': 'New York',
        // Add more as needed
      };
      
      const fullStateName = stateMap[state] || state;
      
      const { data: cityData } = await supabase
        .from("cities")
        .select("id, state")
        .eq("name", city)
        .eq("state", fullStateName)
        .single();

      const { data: categoryData } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", "top10realestateagents")
        .single();

      if (!cityData || !categoryData) {
        toast.error("City or category not found");
        return;
      }

      const payload = {
        city,
        state, // Use state abbreviation
        cityId: cityData.id,
        categoryId: categoryData.id,
        maxAgents
      };

      setRequestPayload(payload);

      const { data, error } = await supabase.functions.invoke(
        "fetch-zillow-agents-twostep",
        { body: payload }
      );

      if (error) {
        setResponseData({ error: error.message });
        toast.error(`Error: ${error.message}`);
      } else {
        setResponseData(data);
        toast.success("Scraper test completed");
      }
    } catch (error: any) {
      console.error("Scraper test error:", error);
      setResponseData({ error: error.message });
      toast.error(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="h-5 w-5" />
          Zillow Scraper Debug Panel
        </CardTitle>
        <CardDescription>
          Test the two-step Zillow scraper and view exact JSON payloads
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Form */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Fresno"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              value={state}
              onChange={(e) => setState(e.target.value.toUpperCase())}
              placeholder="e.g. CA"
              maxLength={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxAgents">Max Agents</Label>
            <Input
              id="maxAgents"
              type="number"
              value={maxAgents}
              onChange={(e) => setMaxAgents(parseInt(e.target.value) || 10)}
              placeholder="10"
            />
          </div>
        </div>

        <Button onClick={testScraper} disabled={loading} className="w-full">
          <Play className="mr-2 h-4 w-4" />
          {loading ? "Running Scraper..." : "Run Test"}
        </Button>

        {/* Request Payload */}
        {requestPayload && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Request Payload Sent:</h3>
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
              {JSON.stringify(requestPayload, null, 2)}
            </pre>
          </div>
        )}

        {/* Response Data */}
        {responseData && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Response Received:</h3>
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs max-h-96 overflow-y-auto">
              {JSON.stringify(responseData, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
