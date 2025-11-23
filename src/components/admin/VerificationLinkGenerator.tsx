import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Link2, Download, RefreshCw, Upload } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface VerificationLink {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  company: string | null;
  business_name: string | null;
  title: string | null;
  address: string | null;
  zip_code: string | null;
  specialty: string[] | null;
  badges: string[] | null;
  description: string | null;
  get_to_know_me: string | null;
  years_experience: number | null;
  total_sales: number | null;
  current_listings: number | null;
  review_stars_rating: number | null;
  num_total_reviews: number | null;
  license_number: string | null;
  zillow_profile_url: string | null;
  rank: number;
  verification_link: string;
  token: string;
  [key: string]: any; // For any additional fields
}

export function VerificationLinkGenerator() {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [links, setLinks] = useState<VerificationLink[]>([]);
  const [cityId, setCityId] = useState<string>('all');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [cities, setCities] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [syncResults, setSyncResults] = useState<any>(null);

  useEffect(() => {
    loadFilters();
  }, []);

  async function loadFilters() {
    const { data: citiesData } = await supabase
      .from('cities')
      .select('id, name, state')
      .eq('active', true)
      .order('name');
    
    const { data: categoriesData } = await supabase
      .from('categories')
      .select('id, name')
      .eq('active', true)
      .order('name');

    if (citiesData) setCities(citiesData);
    if (categoriesData) setCategories(categoriesData);
  }

  async function generateLinks(regenerate = false) {
    try {
      setLoading(true);
      console.log('🔗 Generating verification links...');

      const { data, error } = await supabase.functions.invoke('generate-verification-links', {
        body: { 
          cityId: cityId === 'all' ? '' : cityId, 
          categoryId: categoryId === 'all' ? '' : categoryId, 
          regenerate 
        }
      });

      if (error) throw error;

      setLinks(data.links);
      
      toast.success(`✅ Generated ${data.total} verification links!`, {
        description: regenerate 
          ? `Regenerated ${data.generated} new tokens`
          : `${data.generated} new tokens created`
      });

    } catch (error: any) {
      console.error('Error generating links:', error);
      toast.error('Failed to generate links', {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  }

  function downloadCSV() {
    const headers = [
      'Name',
      'Email',
      'Phone',
      'Website',
      'Company',
      'Business Name',
      'Title',
      'Address',
      'Zip Code',
      'Specialties',
      'Badges',
      'Description',
      'Get to Know Me',
      'Years Experience',
      'Total Sales',
      'Current Listings',
      'Rating',
      'Total Reviews',
      'License Number',
      'Zillow Profile URL',
      'Rank',
      'Verification Link'
    ];
    
    const rows = links.map(link => {
      const specialties = Array.isArray(link.specialty) ? link.specialty.join('; ') : '';
      const badges = Array.isArray(link.badges) ? link.badges.join('; ') : '';
      
      return [
        link.name,
        link.email || '',
        link.phone || '',
        link.website || '',
        link.company || '',
        link.business_name || '',
        link.title || '',
        link.address || '',
        link.zip_code || '',
        specialties,
        badges,
        link.description || '',
        link.get_to_know_me || '',
        link.years_experience || '',
        link.total_sales || '',
        link.current_listings || '',
        link.review_stars_rating || '',
        link.num_total_reviews || '',
        link.license_number || '',
        link.zillow_profile_url || '',
        link.rank,
        link.verification_link
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `verification-links-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast.success('CSV downloaded!');
  }

  function copyLink(link: string) {
    navigator.clipboard.writeText(link);
    toast.success('Link copied to clipboard!');
  }

  async function syncToHubSpot() {
    if (links.length === 0) {
      toast.error('No links to sync', {
        description: 'Generate verification links first'
      });
      return;
    }

    try {
      setSyncing(true);
      setSyncResults(null);
      console.log('🚀 Syncing to HubSpot...');

      const { data, error } = await supabase.functions.invoke('sync-verification-links-to-hubspot', {
        body: { links }
      });

      if (error) throw error;

      setSyncResults(data.results);
      
      toast.success(`✅ Synced to HubSpot!`, {
        description: `${data.results.created} created, ${data.results.updated} updated, ${data.results.failed} failed`
      });

    } catch (error: any) {
      console.error('Error syncing to HubSpot:', error);
      toast.error('Failed to sync to HubSpot', {
        description: error.message
      });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verification Link Generator</CardTitle>
        <CardDescription>
          Generate unique profile verification links for agents to use in HubSpot emails/texts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Filter by City</label>
            <Select value={cityId} onValueChange={setCityId}>
              <SelectTrigger>
                <SelectValue placeholder="All cities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All cities</SelectItem>
                {cities.map(city => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.name}, {city.state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Filter by Category</label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={() => generateLinks(false)} 
            disabled={loading}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Link2 className="mr-2 h-4 w-4" />
                Generate Links
              </>
            )}
          </Button>

          <Button 
            onClick={() => generateLinks(true)} 
            disabled={loading}
            variant="outline"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Regenerate All
          </Button>
        </div>

        {links.length > 0 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {links.length} verification links generated
              </p>
              <div className="flex gap-2">
                <Button onClick={syncToHubSpot} disabled={syncing} variant="default" size="sm">
                  {syncing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Sync to HubSpot
                    </>
                  )}
                </Button>
                <Button onClick={downloadCSV} variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Download CSV
                </Button>
              </div>
            </div>

            {syncResults && (
              <Alert>
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-semibold">HubSpot Sync Results:</p>
                    <ul className="text-sm space-y-1">
                      <li>✅ {syncResults.created} contacts created</li>
                      <li>🔄 {syncResults.updated} contacts updated</li>
                      <li>❌ {syncResults.failed} failed</li>
                    </ul>
                    {syncResults.errors.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm font-medium">
                          View Errors ({syncResults.errors.length})
                        </summary>
                        <ul className="mt-2 text-xs space-y-1 text-muted-foreground">
                          {syncResults.errors.map((error: string, i: number) => (
                            <li key={i}>• {error}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="max-h-96 overflow-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Email</th>
                    <th className="text-left p-2">Phone</th>
                    <th className="text-left p-2">Verification Link</th>
                    <th className="text-left p-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((link) => (
                    <tr key={link.id} className="border-b">
                      <td className="p-2">{link.name}</td>
                      <td className="p-2">{link.email || 'N/A'}</td>
                      <td className="p-2">{link.phone || 'N/A'}</td>
                      <td className="p-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {link.verification_link}
                        </code>
                      </td>
                      <td className="p-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyLink(link.verification_link)}
                        >
                          Copy
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}