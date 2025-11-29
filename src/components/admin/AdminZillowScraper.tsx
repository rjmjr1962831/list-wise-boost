import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MapPin, Users, CheckCircle2, XCircle } from "lucide-react";

export function AdminZillowScraper() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [city, setCity] = useState("");
  const [state, setState] = useState("AZ");
  const [stats, setStats] = useState({ totalProspects: 0, citiesScraped: 0 });
  const [recentJobs, setRecentJobs] = useState<any[]>([]);

  const quickCities = [
    "Phoenix",
    "Scottsdale",
    "Mesa",
    "Chandler",
    "Gilbert",
    "Tempe",
    "Glendale",
    "Peoria",
    "Surprise",
    "Avondale",
  ];

  useEffect(() => {
    fetchStats();
    fetchRecentJobs();
  }, []);

  const fetchStats = async () => {
    const { count: totalProspects } = await supabase
      .from("prospects")
      .select("*", { count: "exact", head: true });

    const { data: cities } = await supabase
      .from("prospects")
      .select("city")
      .not("city", "is", null);

    const uniqueCities = new Set(cities?.map((c) => c.city) || []);

    setStats({
      totalProspects: totalProspects || 0,
      citiesScraped: uniqueCities.size,
    });
  };

  const fetchRecentJobs = async () => {
    const { data } = await supabase
      .from("scrape_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    setRecentJobs(data || []);
  };

  const handleScrape = async (cityName: string, stateName: string) => {
    if (!cityName || !stateName) {
      toast({
        title: "Missing Information",
        description: "Please provide both city and state",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "scrape-zillow-agents",
        {
          body: { city: cityName, state: stateName },
        }
      );

      if (error) throw error;

      toast({
        title: "Scrape Completed",
        description: `Found ${data.agentsFound} agents, saved ${data.agentsSaved} to database`,
      });

      fetchStats();
      fetchRecentJobs();
    } catch (error: any) {
      console.error("Scrape error:", error);
      toast({
        title: "Scrape Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Integration Status */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Pipedrive Integration Active</h3>
              <p className="text-sm text-muted-foreground">
                All scraped agents (rating ≥4.9) are automatically added to the <strong>prospects</strong> table for immediate Pipedrive sync. Each prospect includes Zillow position, page, ratings, sales data, and contact info.
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  const tab = document.querySelector('[value="pipedrive-sync"]') as HTMLElement;
                  tab?.click();
                }}
                className="mt-2"
              >
                Go to Pipedrive Sync →
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Total Prospects</p>
              <p className="text-2xl font-bold">{stats.totalProspects}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <MapPin className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Cities Scraped</p>
              <p className="text-2xl font-bold">{stats.citiesScraped}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick City Buttons */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Scrape Arizona Cities</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {quickCities.map((cityName) => (
            <Button
              key={cityName}
              onClick={() => handleScrape(cityName, "AZ")}
              disabled={loading}
              variant="outline"
            >
              {cityName}
            </Button>
          ))}
        </div>
      </Card>

      {/* Manual City Input */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Manual City Scrape</h3>
        <div className="flex gap-3">
          <Input
            placeholder="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={loading}
          />
          <Input
            placeholder="State (e.g., AZ)"
            value={state}
            onChange={(e) => setState(e.target.value)}
            disabled={loading}
            className="max-w-[120px]"
          />
          <Button
            onClick={() => handleScrape(city, state)}
            disabled={loading || !city || !state}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scraping...
              </>
            ) : (
              "Scrape City"
            )}
          </Button>
        </div>
        {loading && (
          <p className="text-sm text-muted-foreground mt-3">
            This may take 1-3 minutes. Please wait...
          </p>
        )}
      </Card>

      {/* Recent Scrape Jobs */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Scrape Jobs</h3>
        <div className="space-y-2">
          {recentJobs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No scrape jobs yet</p>
          ) : (
            recentJobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {job.status === "completed" ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : job.status === "failed" ? (
                    <XCircle className="h-5 w-5 text-red-500" />
                  ) : (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  )}
                  <div>
                    <p className="font-medium">
                      {job.city}, {job.state}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {job.agents_saved}/{job.agents_found} agents saved
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium capitalize">{job.status}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(job.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
