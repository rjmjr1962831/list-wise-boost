import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Loader2, Edit, AlertCircle } from 'lucide-react';
import { ProfessionalCard } from '@/components/ProfessionalCard';
import { useGA4Tracking } from '@/hooks/useGA4Tracking';

type PageState = 'loading' | 'valid' | 'expired' | 'invalid';

export default function VerifyListingByToken() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { trackEvent } = useGA4Tracking();
  
  const [pageState, setPageState] = useState<PageState>('loading');
  const [professional, setProfessional] = useState<any>(null);

  useEffect(() => {
    const validateAndFetchProfessional = async () => {
      if (!token) {
        setPageState('invalid');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('professionals')
          .select(`
            *,
            cities:city_id (id, name, state, state_slug, slug),
            categories:category_id (id, name, slug)
          `)
          .eq('verification_token', token)
          .maybeSingle();

        if (error) {
          console.error('Error fetching professional:', error);
          setPageState('invalid');
          return;
        }

        if (!data) {
          console.log('No professional found for token:', token);
          setPageState('invalid');
          return;
        }

        // Check if token is expired
        const expiresAt = data.verification_token_expires_at;
        if (expiresAt && new Date(expiresAt) < new Date()) {
          console.log('Token expired:', expiresAt);
          setPageState('expired');
          return;
        }

        // Check if professional is active
        if (!data.active) {
          console.log('Professional is not active');
          setPageState('invalid');
          return;
        }

        console.log('Professional loaded successfully:', data.name);
        setProfessional(data);
        setPageState('valid');

        trackEvent('agent_profile_click', {
          search_type: 'magic_link_access',
          professional_name: data.name,
          professional_id: data.id,
        });
      } catch (error) {
        console.error('Error validating token:', error);
        setPageState('invalid');
      }
    };

    validateAndFetchProfessional();
  }, [token, trackEvent]);

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your listing...</p>
        </div>
      </div>
    );
  }

  if (pageState === 'expired') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Link Expired</h2>
            <p className="text-muted-foreground mb-6">
              This verification link has expired. Please request a new one or use the profile lookup to access your listing.
            </p>
            <Button onClick={() => navigate('/check-profile')}>
              Look Up My Profile
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pageState === 'invalid' || !professional) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Invalid Link</h2>
            <p className="text-muted-foreground mb-6">
              This verification link is invalid or no longer active. Please use the profile lookup to access your listing.
            </p>
            <Button onClick={() => navigate('/check-profile')}>
              Look Up My Profile
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Fixed Accept Now Button */}
        <div className="fixed top-4 right-4 z-50">
          <Button 
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg font-semibold px-8"
            onClick={() => navigate(`/profile/${token}/pricing`)}
          >
            Accept Now
          </Button>
        </div>

        {/* Success Banner */}
        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            <div>
              <p className="font-semibold text-green-900 dark:text-green-100">
                You're on the List! 🎉
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                Great news, {professional.name}! You're featured in our directory.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Heading Section */}
        <div className="space-y-3">
          <h2 className="text-3xl font-bold">Here is what your listing looks like.</h2>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <h3 className="text-xl text-muted-foreground">
              Please review it. You can edit it by clicking the edit button.
            </h3>
            <Button 
              variant="outline"
              size="lg"
              className="shrink-0"
              onClick={() => navigate(`/profile/${token}/edit`)}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit Profile
            </Button>
          </div>
        </div>

        {/* Professional Card */}
        <ProfessionalCard 
          professional={professional}
          accentColor="primary"
          quizCompleted={true}
        />

        {/* Bottom CTA */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-6 text-center">
            <p className="text-lg mb-4">
              Ready to claim your listing and get started?
            </p>
            <Button 
              size="lg"
              onClick={() => navigate(`/profile/${token}/pricing`)}
            >
              Accept Now & View Pricing
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
