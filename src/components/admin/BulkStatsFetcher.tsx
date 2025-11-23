import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const BulkStatsFetcher = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });

  const normalizeName = (name: string) => {
    return name.toLowerCase().trim().replace(/[^a-z\s]/g, '');
  };

  const calculateYearsExperience = (issueDate: string): number => {
    const date = new Date(issueDate);
    const today = new Date();
    const years = (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return Math.round(years);
  };

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
        .select('id, name, zip_code, zillow_profile_url, zillow_data_fetched_at, current_listings, total_sales')
        .eq('city_id', cityData.id)
        .eq('active', true);

      if (profError) throw profError;

      if (!professionals || professionals.length === 0) {
        toast.info(`No professionals found in ${cityName}`);
        return;
      }

      // Filter out agents enriched within last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const professionalsToProcess = professionals.filter(prof => {
        const needsEnrichment = !prof.zillow_data_fetched_at || 
          new Date(prof.zillow_data_fetched_at) < thirtyDaysAgo ||
          !prof.current_listings ||
          !prof.total_sales;
        return needsEnrichment;
      });
      
      const skippedCount = professionals.length - professionalsToProcess.length;
      
      setProgress(prev => ({ ...prev, total: professionalsToProcess.length }));
      
      if (skippedCount > 0) {
        toast.info(`⚡ Skipping ${skippedCount} recently-enriched agents. Processing ${professionalsToProcess.length} in ${cityName}`);
      } else {
        toast.info(`Starting stats fetch for ${professionalsToProcess.length} agents in ${cityName}`);
      }
      
      if (professionalsToProcess.length === 0) {
        toast.success(`All ${professionals.length} agents in ${cityName} are up to date!`);
        setIsProcessing(false);
        return;
      }

      // Load and parse Arizona license CSV
      const licenseMap = new Map();
      try {
        const response = await fetch('/arizona-licenses.csv');
        const csvText = await response.text();
        const lines = csvText.split('\n');

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const values = line.split(',');
          if (values.length < 13) continue;

          const lastName = values[0]?.replace(/"/g, '').trim();
          const firstName = values[1]?.replace(/"/g, '').trim();
          const middleName = values[2]?.replace(/"/g, '').trim();
          const fullName = `${firstName} ${middleName} ${lastName}`.replace(/\s+/g, ' ').trim();
          const normalizedName = normalizeName(fullName);

          const issueDate = values[3]?.replace(/"/g, '').trim();
          const licNumber = values[4]?.replace(/"/g, '').trim();
          const phone = values[7]?.replace(/"/g, '').trim();

          licenseMap.set(normalizedName, {
            licenseNumber: licNumber,
            phone,
            yearsExperience: calculateYearsExperience(issueDate),
            licenseVerifiedAt: new Date().toISOString()
          });
        }
        console.log(`Loaded ${licenseMap.size} licenses from CSV`);
      } catch (error) {
        console.error('Error loading license CSV:', error);
        toast.warning('Could not load license data, will only fetch Zillow stats');
      }

      let success = 0;
      let failed = 0;

      for (let i = 0; i < professionalsToProcess.length; i++) {
        const prof = professionalsToProcess[i];
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
            // Check rating threshold
            const rating = stats.rating || 0;
            if (rating < 4.85) {
              console.log(`Skipping ${prof.name}: rating ${rating} below 4.85 threshold`);
              failed++;
              continue;
            }

            // Get license data from CSV
            const normalizedProfName = normalizeName(prof.name);
            const licenseData = licenseMap.get(normalizedProfName);
            
            // Prepare update with stats and license data
            const updateData: any = {
              current_listings: stats.currentListings || 0,
              total_sales: stats.totalSales || 0,
              years_experience: licenseData?.yearsExperience, // Only from license
              zip_code: stats.zipCode || prof.zip_code,
              zillow_data_fetched_at: new Date().toISOString()
            };

            // Add license data if available
            if (licenseData) {
              updateData.license_number = licenseData.licenseNumber;
              updateData.phone = licenseData.phone;
              updateData.license_verified_at = licenseData.licenseVerifiedAt;
            }
            
            // Update professional with combined data
            const { error: updateError } = await supabase
              .from('professionals')
              .update(updateData)
              .eq('id', prof.id);

            if (updateError) {
              console.error(`Error updating ${prof.name}:`, updateError);
              failed++;
            } else {
              success++;
              console.log(`✓ Updated ${prof.name} (rating: ${rating}): ${stats.currentListings} current, ${stats.totalSales} total, ${updateData.years_experience} years exp`);
            }
          } else {
            console.log(`No stats found for ${prof.name} from either API`);
            failed++;
          }

          // Rate limiting: wait 2 seconds between requests
          if (i < professionalsToProcess.length - 1) {
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
          Only processes agents with 4.85+ Zillow rating. Years of experience calculated from license issue date.
          Updates: current_listings, total_sales, years_experience (from license), license_number, phone, zip_code.
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
          <strong>Data Sources:</strong> Zillow stats from GetDataForMe/Memo23 APIs + License data from arizona-licenses.csv
          <br />
          <strong>API Strategy:</strong> Tries GetDataForMe first, falls back to Memo23 if needed.
          <br />
          <strong>Rate Limiting:</strong> 2 seconds between requests to avoid API throttling.
          Each city may take several minutes to complete.
        </div>
      </CardContent>
    </Card>
  );
};
