import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const BulkStatsFetcher = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });

  const fetchStatsForCity = async (cityName: string) => {
    setIsProcessing(true);
    setProgress({ current: 0, total: 0, success: 0, failed: 0 });

    try {
      // Get city ID
      const { data: cityData, error: cityError } = await supabase
        .from('cities')
        .select('id, state')
        .eq('name', cityName)
        .single();

      if (cityError) throw cityError;

      // Fetch all professionals in this city
      const { data: professionals, error: profError } = await supabase
        .from('professionals')
        .select('id, name, zip_code, zillow_profile_url')
        .eq('city_id', cityData.id)
        .eq('active', true);

      if (profError) throw profError;

      if (!professionals || professionals.length === 0) {
        toast.info(`No professionals found in ${cityName}`);
        return;
      }

      setProgress(prev => ({ ...prev, total: professionals.length }));
      toast.info(`Starting stats fetch for ${professionals.length} agents in ${cityName}`);

      let success = 0;
      let failed = 0;

      for (let i = 0; i < professionals.length; i++) {
        const prof = professionals[i];
        setProgress(prev => ({ ...prev, current: i + 1 }));

        try {
          console.log(`Fetching stats for ${prof.name}...`);

          let stats = null;

          // Try getdataforme first
          try {
            const { data, error } = await supabase.functions.invoke('fetch-getdataforme-agent-stats', {
              body: {
                profileUrl: prof.zillow_profile_url,
                zipcode: prof.zip_code,
                location: prof.zip_code ? undefined : `${cityName}, ${cityData.state}`,
                agentName: prof.name,
              }
            });

            if (!error && data?.success && data?.stats) {
              stats = data.stats;
              console.log(`✓ GetDataForMe found stats for ${prof.name}`);
            }
          } catch (e) {
            console.log(`GetDataForMe failed for ${prof.name}, trying memo23...`);
          }

          // Try memo23 as fallback if getdataforme didn't work
          if (!stats) {
            try {
              const { data, error } = await supabase.functions.invoke('fetch-apify-agent-stats', {
                body: {
                  agentName: prof.name,
                  city: cityName,
                  state: cityData.state,
                  zipcode: prof.zip_code,
                }
              });

              if (!error && data?.success && data?.stats) {
                stats = data.stats;
                console.log(`✓ Memo23 found stats for ${prof.name}`);
              }
            } catch (e) {
              console.log(`Memo23 also failed for ${prof.name}`);
            }
          }

          if (stats) {
            
            // Update professional with stats
            const { error: updateError } = await supabase
              .from('professionals')
              .update({
                current_listings: stats.currentListings || 0,
                total_sales: stats.totalSales || 0,
                years_experience: stats.yearsExperience,
                zip_code: stats.zipCode || prof.zip_code,
                zillow_data_fetched_at: new Date().toISOString()
              })
              .eq('id', prof.id);

            if (updateError) {
              console.error(`Error updating ${prof.name}:`, updateError);
              failed++;
            } else {
              success++;
              console.log(`✓ Updated ${prof.name}: ${stats.currentListings} current, ${stats.totalSales} total`);
            }
          } else {
            console.log(`No stats found for ${prof.name} from either API`);
            failed++;
          }

          // Rate limiting: wait 2 seconds between requests
          if (i < professionals.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error) {
          console.error(`Failed to process ${prof.name}:`, error);
          failed++;
        }

        setProgress(prev => ({ ...prev, success, failed }));
      }

      toast.success(`Completed! ${success} succeeded, ${failed} failed`);
    } catch (error) {
      console.error('Error in bulk stats fetch:', error);
      toast.error('Failed to fetch stats: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Stats Fetcher (GetDataForMe + Memo23 APIs)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Fetch Zillow stats for all agents in a city using GetDataForMe API (primary) and Memo23 API (fallback).
          This will update current_listings, total_sales, and years_experience.
        </p>

        {isProcessing && (
          <div className="space-y-2 p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">
                Processing {progress.current} of {progress.total}...
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Success: {progress.success} | Failed: {progress.failed}
            </div>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => fetchStatsForCity('Tucson')}
            disabled={isProcessing}
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Fetch Tucson Stats
          </Button>
          <Button
            onClick={() => fetchStatsForCity('Phoenix')}
            disabled={isProcessing}
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Fetch Phoenix Stats
          </Button>
          <Button
            onClick={() => fetchStatsForCity('Scottsdale')}
            disabled={isProcessing}
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Fetch Scottsdale Stats
          </Button>
          <Button
            onClick={() => fetchStatsForCity('Gilbert')}
            disabled={isProcessing}
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Fetch Gilbert Stats
          </Button>
        </div>

        <div className="text-xs text-muted-foreground mt-4">
          <strong>API Strategy:</strong> Tries GetDataForMe first, falls back to Memo23 if needed.
          <br />
          <strong>Rate Limiting:</strong> 2 seconds between requests to avoid API throttling.
          Each city may take several minutes to complete.
        </div>
      </CardContent>
    </Card>
  );
};
