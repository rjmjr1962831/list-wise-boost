import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Edit, Loader2, CheckCircle2 } from 'lucide-react';
import { ProfessionalCard } from '@/components/ProfessionalCard';
import { FunnelPhoneSupport } from '@/components/funnel/FunnelPhoneSupport';

export default function ClaimListingPreview() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string>('');

  // Test profile UUID for Robert Maynard
  const TEST_PROFILE_ID = '45415a04-dffe-46d0-96c6-fe8dbf6cebff';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const loadProfessional = async () => {
      const lookup = token || TEST_PROFILE_ID;

      try {
        let data = null;

        // Try by ID first with full data needed for ProfessionalCard
        const byId = await supabase
          .from('professionals')
          .select(`
            *,
            cities:city_id (id, name, state, state_slug, slug),
            categories:category_id (id, name, slug)
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
              cities:city_id (id, name, state, state_slug, slug),
              categories:category_id (id, name, slug)
            `)
            .eq('verification_token', lookup)
            .maybeSingle();

          data = byToken.data;
        }

        if (!data) {
          setError('Profile not found');
          return;
        }

        setProfileId(data.id);
        setProfessional(data);
      } catch (err) {
        console.error('ClaimListingPreview loadProfessional error:', err);
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfessional();
  }, [token]);

  const handleFinish = () => {
    // Store professional context and navigate to visibility funnel
    if (profileId) {
      sessionStorage.setItem('visibility_professional_token', profileId);
    }
    navigate('/visibility/coverage');
  };

  const handleContinueEditing = () => {
    navigate(`/profile/${profileId}/edit`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading your profile...</p>
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
        <title>Preview Your Profile | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-b from-background to-muted">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            
            {/* Step Indicator & Header */}
            <div className="text-center mb-8">
              <p className="text-sm font-medium text-primary mb-2">Step 4 of 5 (2 minutes)</p>
              <h1 className="text-3xl md:text-4xl font-bold mb-3">
                Your Public Profile
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                This is how your profile currently appears to consumers and AI systems on Top10Lists.us. 
                You may continue editing at any time.
              </p>
            </div>

            {/* Actual Professional Card - Same as consumer sees */}
            <div className="mb-8">
              <ProfessionalCard 
                professional={professional} 
                accentColor="primary" 
                quizCompleted={true}
                expandSections={true}
              />
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
                onClick={handleFinish}
                className="w-full sm:w-auto"
              >
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Finish
              </Button>
            </div>

            {/* Info Note */}
            <p className="text-center text-sm text-muted-foreground mt-6">
              Your profile is visible to consumers searching for top agents in your selected areas.
            </p>
          </div>
        </div>
      </div>

      <FunnelPhoneSupport />
    </>
  );
}
