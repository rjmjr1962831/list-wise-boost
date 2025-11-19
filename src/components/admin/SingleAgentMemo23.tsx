import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfessionalCard } from '@/components/ProfessionalCard';

export const SingleAgentMemo23 = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('professionals')
        .select(`
          *,
          city:cities(name, slug, state),
          category:categories(name, slug)
        `)
        .eq('id', '4bf24984-40fe-4077-92c7-316ac57989d4')
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const fetchAdamData = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      // Step 1: Fetch from agenscrape
      toast.info('Step 1/2: Fetching agenscrape data for Adam Hamblen...');
      
      const agenscrapeResult = await supabase.functions.invoke('fetch-agenscrape-agents', {
        body: { 
          citySlug: 'glendale',
          cityName: 'Glendale',
          stateName: 'Arizona',
          categorySlug: 'realtors'
        }
      });

      if (agenscrapeResult.error) {
        console.error('Agenscrape error:', agenscrapeResult.error);
        toast.warning('Agenscrape fetch had issues, continuing to memo23...');
      } else {
        toast.success('Agenscrape data fetched');
      }
      
      // Step 2: Fetch from memo23
      toast.info('Step 2/2: Fetching memo23 data for Adam Hamblen...');
      
      const { data, error } = await supabase.functions.invoke('fetch-single-memo23-agent', {
        body: { professionalId: '4bf24984-40fe-4077-92c7-316ac57989d4' }
      });

      if (error) throw error;

      setResult(data);
      toast.success('Successfully fetched all data for Adam Hamblen');
      
      // Step 3: Auto-refresh the profile to show updated data
      toast.info('Rebuilding profile card...');
      await fetchProfile();
      toast.success('Profile card rebuilt with fresh data');
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Adam Hamblen Profile - As Rendered</CardTitle>
        </CardHeader>
        <CardContent>
          {profileLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading profile...</span>
            </div>
          ) : profile ? (
            <ProfessionalCard
              professional={{
                ...profile,
                // Map database fields to component expected fields
                image: profile.image_url || '/placeholder.svg',
                rating: profile.ratings?.average || profile.review_stars_rating || 0,
                reviews: profile.num_total_reviews || 0,
                specialties: profile.specialty || [],
                verified: profile.claim_status === 'approved',
                stats: {
                  totalSales: profile.total_sales || 0,
                  currentListings: profile.current_listings || 0,
                  yearsExperience: profile.years_experience || 0
                }
              }}
              categorySlug={profile.category?.slug || ''}
            />
          ) : (
            <p className="text-muted-foreground">No profile data</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fetch Fresh Memo23 Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={fetchAdamData} 
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Fetching data from all sources...
              </>
            ) : (
              'Run Full Debug (Agenscrape + Memo23 + Rebuild)'
            )}
          </Button>

          {result && (
            <div className="space-y-2">
              <h4 className="font-semibold">Result:</h4>
              <div className="bg-muted p-4 rounded-lg">
                <p><strong>Professional:</strong> {result.professional}</p>
                <p><strong>Sidebar Video URL:</strong> {result.sidebarVideoUrl || 'Not found'}</p>
                <p><strong>Updated Fields:</strong> {result.updatedFields?.join(', ')}</p>
              </div>
              
              {result.sidebarVideoUrl && (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2">Video Preview:</h4>
                  <iframe
                    width="320"
                    height="180"
                    src={`https://www.youtube.com/embed/${result.sidebarVideoUrl.split('v=')[1]?.split('&')[0] || result.sidebarVideoUrl.split('/').pop()?.split('?')[0]}`}
                    title="Agent video"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="rounded-lg border-2"
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};