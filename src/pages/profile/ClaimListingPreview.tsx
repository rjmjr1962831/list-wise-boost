import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ProfessionalCard } from '@/components/ProfessionalCard';
import { CheckCircle2, Edit, Loader2 } from 'lucide-react';
import { Professional } from '@/types/professional';
import { getValidImageUrl } from '@/utils/imageUrlValidator';

export default function ClaimListingPreview() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string>('');

  // Test profile UUID for Robert Maynard
  const TEST_PROFILE_ID = '45415a04-dffe-46d0-96c6-fe8dbf6cebff';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const loadProfessional = async () => {
      // Token can be either the professional id OR the verification_token.
      const lookup = token || TEST_PROFILE_ID;

      try {
        let data: any = null;

        // Try by ID first
        const byId = await supabase
          .from('professionals')
          .select(`
            *,
            cities!inner(name, state, slug, state_slug),
            categories!inner(name, slug, plural_name)
          `)
          .eq('id', lookup)
          .maybeSingle();

        data = byId.data;

        // Fallback: try by verification_token
        if (!data) {
          const byToken = await supabase
            .from('professionals')
            .select(`
              *,
              cities!inner(name, state, slug, state_slug),
              categories!inner(name, slug, plural_name)
            `)
            .eq('verification_token', lookup)
            .maybeSingle();

          data = byToken.data;
        }

        if (!data) {
          setError('Profile not found');
          return;
        }

        // Always navigate using the canonical professional id
        setProfileId(data.id);

        // Transform to Professional type (with extra fields for ProfessionalCard rendering)
        const pro: Professional & { get_to_know_me?: string; original_description?: string } = {
          id: data.id,
          name: data.name,
          title: data.title || '',
          company: data.company || '',
          image: getValidImageUrl(data.image_url),
          rating: data.review_stars_rating || 0,
          reviews: data.num_total_reviews || 0,
          specialties: data.specialty || [],
          address: data.address || '',
          description: data.description || '',
          phone: data.phone || '',
          email: data.email || '',
          website: data.website || '',
          rank: data.rank,
          stats: {
            yearsExperience: data.years_experience,
            totalSales: data.total_sales,
            currentListings: data.current_listings
          },
          verified: !!data.license_verified_at,
          notable_achievements: (data.notable_achievements as any[]) || [],
          press_mentions: (data.press_mentions as any[]) || [],
          synthesized_bio: data.synthesized_bio,
          get_to_know_me: data.get_to_know_me,
          original_description: data.description,

          // Fields used by ProfessionalCard for license + verification display
          license_number: data.license_number,
          license_verified_at: data.license_verified_at,
          years_experience: data.years_experience,
          total_sales: data.total_sales,
          current_listings: data.current_listings
        };

        setProfessional(pro);
      } catch (err) {
        console.error('ClaimListingPreview loadProfessional error:', err);
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfessional();
  }, [token]);

  const handleClaimListing = () => {
    navigate(`/profile/${profileId}/pricing`);
  };

  const handleContinueEditing = () => {
    navigate(`/profile/${profileId}/edit`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading your listing...</p>
        </div>
      </div>
    );
  }

  if (error || !professional) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <p className="text-destructive text-center">{error || 'Unable to load profile'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Claim Your Listing | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3">
              Great! Here's what your listing looks like
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              If everything looks good, click "Claim My Free Listing" to make it live.
              You can always come back and edit it later.
            </p>
          </div>

          {/* Card Preview */}
          <div className="mb-8">
            <ProfessionalCard professional={professional} />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              variant="outline"
              size="lg"
              onClick={handleContinueEditing}
              className="w-full sm:w-auto"
            >
              <Edit className="mr-2 h-5 w-5" />
              Continue Editing
            </Button>
            <Button
              size="lg"
              onClick={handleClaimListing}
              className="w-full sm:w-auto bg-gradient-to-r from-primary to-sunset-orange hover:opacity-90"
            >
              <CheckCircle2 className="mr-2 h-5 w-5" />
              Claim My Free Listing
            </Button>
          </div>

          {/* Info Note */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            Your listing will be visible to potential clients searching for top agents in your area.
          </p>
        </div>
      </div>
      </div>
    </>
  );
}
