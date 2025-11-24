import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Loader2, Database } from "lucide-react";

export const Memo23FieldsExporter = () => {
  const [loading, setLoading] = useState(false);

  const exportMemo23Fields = async () => {
    try {
      setLoading(true);

      // Fetch professionals with memo23 data
      const { data: professionals, error } = await supabase
        .from('professionals')
        .select('*')
        .eq('active', true)
        .not('professional_information', 'is', null)
        .limit(100);

      if (error) throw error;

      if (!professionals || professionals.length === 0) {
        toast.info('No professionals with memo23 data found');
        return;
      }

      // Get city names
      const cityIds = [...new Set(professionals.map(p => p.city_id))];
      const { data: cities } = await supabase
        .from('cities')
        .select('id, name, state')
        .in('id', cityIds);

      const cityMap = new Map(cities?.map(c => [c.id, `${c.name}, ${c.state}`]) || []);

      // All memo23 fields we're capturing
      const headers = [
        'name',
        'city',
        'zillow_profile_url',
        'encoded_zuid',
        'zuid',
        'screen_name',
        'is_premier_agent',
        'is_top_agent',
        'review_stars_rating',
        'num_total_reviews',
        'total_sales',
        'current_listings',
        'license_number',
        'years_experience',
        'email',
        'phone',
        'website',
        'business_name',
        'description',
        'get_to_know_me',
        'specialty',
        'badges',
        'professional_information_json',
        'agent_sales_stats_json',
        'agent_licenses_json',
        'phone_numbers_json',
        'business_address_json',
        'ratings_json',
        'profile_types_json',
        'team_display_information_json',
        'past_sales_json',
        'reviews_data_json',
        'zillow_data_fetched_at',
        'license_verified_at'
      ];

      const rows = professionals.map(prof => {
        // Helper to safely stringify JSON
        const safeJson = (obj: any) => {
          if (!obj) return '';
          try {
            return JSON.stringify(obj).replace(/"/g, '""');
          } catch {
            return '';
          }
        };

        return [
          prof.name,
          cityMap.get(prof.city_id) || 'Unknown',
          prof.zillow_profile_url || '',
          prof.encoded_zuid || '',
          prof.zuid || '',
          prof.screen_name || '',
          prof.is_premier_agent ? 'true' : 'false',
          prof.is_top_agent ? 'true' : 'false',
          prof.review_stars_rating || '',
          prof.num_total_reviews || '',
          prof.total_sales || '',
          prof.current_listings || '',
          prof.license_number || '',
          prof.years_experience || '',
          prof.email || '',
          prof.phone || '',
          prof.website || '',
          prof.business_name || '',
          prof.description || '',
          prof.get_to_know_me || '',
          Array.isArray(prof.specialty) ? prof.specialty.join('; ') : '',
          Array.isArray(prof.badges) ? prof.badges.join('; ') : '',
          safeJson(prof.professional_information),
          safeJson(prof.agent_sales_stats),
          safeJson(prof.agent_licenses),
          safeJson(prof.phone_numbers),
          safeJson(prof.business_address),
          safeJson(prof.ratings),
          safeJson(prof.profile_types),
          safeJson(prof.team_display_information),
          safeJson(prof.past_sales),
          safeJson(prof.reviews_data),
          prof.zillow_data_fetched_at || '',
          prof.license_verified_at || ''
        ].map(cell => `"${String(cell)}"`).join(',');
      });

      const headerRow = headers.map(h => `"${h}"`).join(',');
      const csv = [headerRow, ...rows].join('\n');

      // Download CSV
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `memo23-fields-export-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exported ${professionals.length} agents with memo23 data`);
    } catch (error: any) {
      console.error('Error exporting memo23 fields:', error);
      toast.error('Failed to export data');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    // Create empty template with just headers
    const headers = [
      'name',
      'city',
      'zillow_profile_url',
      'encoded_zuid',
      'zuid',
      'screen_name',
      'is_premier_agent',
      'is_top_agent',
      'review_stars_rating',
      'num_total_reviews',
      'total_sales',
      'current_listings',
      'license_number',
      'years_experience',
      'email',
      'phone',
      'website',
      'business_name',
      'description',
      'get_to_know_me',
      'specialty',
      'badges',
      'professional_information_json',
      'agent_sales_stats_json',
      'agent_licenses_json',
      'phone_numbers_json',
      'business_address_json',
      'ratings_json',
      'profile_types_json',
      'team_display_information_json',
      'past_sales_json',
      'reviews_data_json',
      'zillow_data_fetched_at',
      'license_verified_at'
    ];

    const csv = headers.map(h => `"${h}"`).join(',');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'memo23-fields-template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Template downloaded');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Memo23 Fields Export
        </CardTitle>
        <CardDescription>
          Export all fields captured from memo23 scraper or download an empty template
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Memo23 Fields Captured:</h4>
          <div className="text-xs text-muted-foreground grid grid-cols-2 gap-1">
            <div>• name, city, zillow_profile_url</div>
            <div>• encoded_zuid, zuid, screen_name</div>
            <div>• is_premier_agent, is_top_agent</div>
            <div>• review_stars_rating, num_total_reviews</div>
            <div>• total_sales, current_listings</div>
            <div>• license_number, years_experience</div>
            <div>• email, phone, website</div>
            <div>• business_name, description</div>
            <div>• get_to_know_me, specialty, badges</div>
            <div>• professional_information (JSON)</div>
            <div>• agent_sales_stats (JSON)</div>
            <div>• agent_licenses (JSON)</div>
            <div>• phone_numbers (JSON)</div>
            <div>• business_address (JSON)</div>
            <div>• ratings (JSON)</div>
            <div>• profile_types (JSON)</div>
            <div>• team_display_information (JSON)</div>
            <div>• past_sales (JSON)</div>
            <div>• reviews_data (JSON)</div>
            <div>• zillow_data_fetched_at</div>
            <div>• license_verified_at</div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={exportMemo23Fields}
            disabled={loading}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export Data (100 agents)
              </>
            )}
          </Button>

          <Button
            onClick={downloadTemplate}
            variant="outline"
            className="flex-1"
          >
            <Download className="mr-2 h-4 w-4" />
            Download Template
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
