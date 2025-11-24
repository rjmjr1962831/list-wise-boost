import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Download, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

export function CRMExportGenerator() {
  const [loading, setLoading] = useState(false);
  const [purging, setPurging] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(true);
  const [onlyQualified, setOnlyQualified] = useState(false);
  const [stats, setStats] = useState<{ total: number; withEmail: number; withPhone: number; active: number; inactive: number } | null>(null);

  async function generateCRMExport() {
    try {
      setLoading(true);
      console.log('📊 Generating comprehensive CRM export (including all enriched agents)...');

      // Fetch ALL professionals with ALL fields (active and inactive if checkbox is checked)
      let query = supabase
        .from('professionals')
        .select(`
          *,
          cities (name, state, slug),
          categories (name, plural_name, slug)
        `);
      
      if (!includeInactive) {
        query = query.eq('active', true);
      }

      // Filter for qualified agents only
      if (onlyQualified) {
        query = query
          .not('email_verified_at', 'is', null)
          .gte('review_stars_rating', 4.9);
      }
      
      const { data: professionals, error } = await query
        .order('city_id')
        .order('rank');

      if (error) throw error;
      if (!professionals || professionals.length === 0) {
        toast.error('No professionals found');
        return;
      }

      // Calculate stats
      const withEmail = professionals.filter(p => p.email && !p.email.includes('unavailable')).length;
      const withPhone = professionals.filter(p => p.phone && p.phone !== 'N/A').length;
      const active = professionals.filter(p => p.active).length;
      const inactive = professionals.length - active;
      setStats({ total: professionals.length, withEmail, withPhone, active, inactive });

      // Generate CSV with ALL fields including enrichment data
      const headers = [
        'ID',
        'Name',
        'Email',
        'Phone',
        'Website',
        'Company',
        'Business Name',
        'Brokerage',
        'Title',
        'Address',
        'Zip Code',
        'City',
        'State',
        'Category',
        'Rank',
        'Type',
        'Specialties',
        'Badges',
        'Years Experience',
        'Total Sales',
        'Current Listings',
        'Rating',
        'Total Reviews',
        'License Number',
        'Zillow Profile URL',
        'Zillow ZUID',
        'Description',
        'Bio (Get to Know Me)',
        'Video URL',
        'Phone Numbers (JSON)',
        'Professional Info (JSON)',
        'Agent Licenses (JSON)',
        'Agent Sales Stats (JSON)',
        'Business Address (JSON)',
        'Review Link',
        'Is Premier Agent',
        'Is Top Agent',
        'Claim Status',
        'Email Verified',
        'License Verified',
        'Last Enriched',
        'Created At',
        'Updated At',
        'Verification Link',
        'Top10 Profile Link'
      ];

      const rows = professionals.map(prof => {
        // Generate verification link
        const verificationLink = prof.verification_token 
          ? `https://top10lists.us/verify-listing/${prof.verification_token}`
          : 'No token';

        // Generate Top10 profile link
        const stateSlug = (prof.cities as any)?.state_slug || 'unknown';
        const citySlug = prof.cities?.slug || 'unknown';
        const categorySlug = prof.categories?.slug || 'unknown';
        const top10Link = `https://top10lists.us/${stateSlug}/${citySlug}/${categorySlug}`;

        // Parse specialties and badges
        const specialties = Array.isArray(prof.specialty) ? prof.specialty.join('; ') : '';
        const badges = Array.isArray(prof.badges) ? prof.badges.join('; ') : '';

        // Serialize JSON fields for CSV
        const phoneNumbersJson = prof.phone_numbers ? JSON.stringify(prof.phone_numbers) : '';
        const professionalInfoJson = prof.professional_information ? JSON.stringify(prof.professional_information) : '';
        const agentLicensesJson = prof.agent_licenses ? JSON.stringify(prof.agent_licenses) : '';
        const agentSalesStatsJson = prof.agent_sales_stats ? JSON.stringify(prof.agent_sales_stats) : '';
        const businessAddressJson = prof.business_address ? JSON.stringify(prof.business_address) : '';

        return [
          prof.id,
          prof.name,
          prof.email || 'N/A',
          prof.phone || 'N/A',
          prof.website || '',
          prof.company || '',
          prof.business_name || '',
          prof.company || prof.business_name || '',
          prof.title || '',
          prof.address || '',
          prof.zip_code || '',
          prof.cities?.name || '',
          prof.cities?.state || '',
          prof.categories?.name || '',
          prof.rank,
          prof.type,
          specialties,
          badges,
          prof.years_experience || '',
          prof.total_sales || '',
          prof.current_listings || '',
          prof.review_stars_rating || '',
          prof.num_total_reviews || '',
          prof.license_number || '',
          prof.zillow_profile_url || '',
          prof.zuid || '',
          prof.description || '',
          prof.get_to_know_me || '',
          prof.sidebar_video_url || '',
          phoneNumbersJson,
          professionalInfoJson,
          agentLicensesJson,
          agentSalesStatsJson,
          businessAddressJson,
          prof.review_link || '',
          prof.is_premier_agent ? 'Yes' : 'No',
          prof.is_top_agent ? 'Yes' : 'No',
          prof.claim_status || 'unclaimed',
          prof.email_verified_at ? 'Yes' : 'No',
          prof.license_verified_at ? 'Yes' : 'No',
          prof.zillow_data_fetched_at || '',
          prof.created_at,
          prof.updated_at,
          verificationLink,
          top10Link
        ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
      });

      const csv = [headers.join(','), ...rows].join('\n');

      // Download CSV
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crm-export-complete-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success(`✅ CRM Export Complete!`, {
        description: `${professionals.length} agents exported`
      });

    } catch (error: any) {
      console.error('Error generating CRM export:', error);
      toast.error('Failed to generate CRM export', {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  }

  async function purgeAlaskaNorthDakota() {
    try {
      setPurging(true);
      console.log('🗑️ Purging Alaska and North Dakota agents...');

      // First, get all cities in Alaska and North Dakota
      const { data: cities, error: citiesError } = await supabase
        .from('cities')
        .select('id, name, state')
        .in('state', ['Alaska', 'North Dakota']);

      if (citiesError) throw citiesError;
      if (!cities || cities.length === 0) {
        toast.info('No cities found in Alaska or North Dakota');
        return;
      }

      const cityIds = cities.map(c => c.id);
      console.log(`Found ${cities.length} cities in AK/ND:`, cities.map(c => `${c.name}, ${c.state}`));

      // Get count of agents to be deleted
      const { count } = await supabase
        .from('professionals')
        .select('*', { count: 'exact', head: true })
        .in('city_id', cityIds);

      if (!count || count === 0) {
        toast.info('No agents found in Alaska or North Dakota');
        return;
      }

      // Delete all professionals in those cities
      const { error: deleteError } = await supabase
        .from('professionals')
        .delete()
        .in('city_id', cityIds);

      if (deleteError) throw deleteError;

      toast.success(`✅ Purged ${count} agents from Alaska and North Dakota`);
      console.log(`✅ Successfully deleted ${count} agents from AK/ND`);

    } catch (error: any) {
      console.error('Error purging agents:', error);
      toast.error('Failed to purge agents', {
        description: error.message
      });
    } finally {
      setPurging(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comprehensive CRM Export</CardTitle>
        <CardDescription>
          Export ALL agent data including contact info, stats, and verification links
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats && (
          <Alert>
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-semibold">Last Export Stats:</p>
                <ul className="text-sm space-y-1">
                  <li>📊 Total agents: {stats.total}</li>
                  <li>✅ Active: {stats.active}</li>
                  <li>⏸️ Inactive: {stats.inactive}</li>
                  <li>📧 With email: {stats.withEmail} ({Math.round((stats.withEmail / stats.total) * 100)}%)</li>
                  <li>📱 With phone: {stats.withPhone} ({Math.round((stats.withPhone / stats.total) * 100)}%)</li>
                  <li>❌ Missing email: {stats.total - stats.withEmail}</li>
                  <li>❌ Missing phone: {stats.total - stats.withPhone}</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="includeInactive"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="includeInactive" className="text-sm font-medium">
              Include inactive agents (recommended for full enrichment data)
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="onlyQualified"
              checked={onlyQualified}
              onChange={(e) => setOnlyQualified(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="onlyQualified" className="text-sm font-medium">
              Only qualified agents (verified email + rating 4.9+)
            </label>
          </div>
        </div>

        <Button
          onClick={generateCRMExport} 
          disabled={loading}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Export...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Generate Complete CRM Export
            </>
          )}
        </Button>

        <div className="text-sm text-muted-foreground space-y-2 border-t pt-4">
          <p className="font-semibold">Includes all fields + enrichment data:</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Full contact info (email, phone, website)</li>
            <li>Business details (company, brokerage, address)</li>
            <li>Performance stats (sales, listings, ratings)</li>
            <li>Specialties and badges</li>
            <li>License and verification status</li>
            <li>Zillow profile data (ZUID, profile URL)</li>
            <li><strong>Enrichment data</strong>: Video URL, phone numbers JSON, professional info JSON, licenses JSON, sales stats JSON</li>
            <li>Last enriched timestamp</li>
            <li>Verification link for each agent</li>
            <li>Top10 profile link for each agent</li>
          </ul>
          <p className="text-xs italic mt-2">💡 Professional Info JSON contains broker addresses, websites, social links - parse for missing contact data</p>
        </div>

        <div className="border-t pt-4 mt-4">
          <p className="text-sm font-semibold text-destructive mb-2">⚠️ Danger Zone</p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                disabled={purging}
                className="w-full"
              >
                {purging ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Purging...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Purge Alaska & North Dakota Agents
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete ALL agents from Alaska and North Dakota.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={purgeAlaskaNorthDakota}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  Yes, purge them
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
