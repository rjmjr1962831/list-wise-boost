import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, CheckCircle2, MapPin, TrendingUp, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function WelcomeInterstitial() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<any>(null);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        navigate('/404');
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('validate-profile-token', {
          body: { token }
        });

        if (error || !data?.success) {
          toast({
            title: 'Invalid Link',
            description: 'This verification link is invalid or has expired.',
            variant: 'destructive'
          });
          navigate('/404');
          return;
        }

        setProfessional(data.professional);
        
        // Track welcome view
        supabase.functions.invoke('track-profile-event', {
          body: { token, event_name: 'welcome_viewed' }
        });
      } catch (err) {
        console.error('Error validating token:', err);
        toast({
          title: 'Error',
          description: 'Something went wrong. Please try again.',
          variant: 'destructive'
        });
        navigate('/404');
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token, navigate, toast]);

  const handleContinue = () => {
    navigate(`/profile/${token}/edit`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const firstName = professional?.name?.split(' ')[0] || 'there';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Welcome, {firstName}! 👋
          </h1>
          <p className="text-xl text-muted-foreground">
            You've been selected for a <span className="font-semibold text-primary">free listing</span> on Top10Lists
          </p>
        </div>

        {/* Main Card */}
        <Card className="p-8 md:p-12 shadow-xl border-2 border-primary/20">
          <div className="space-y-8">
            {/* Free Benefits Section */}
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                What You're Getting (Free) 🎁
              </h2>
              <div className="grid gap-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">AI-Optimized Profile</p>
                    <p className="text-sm text-muted-foreground">
                      We've created your listing using data from public sources
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">1 City Listing</p>
                    <p className="text-sm text-muted-foreground">
                      Featured in search results for your primary market
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <TrendingUp className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">Rotating Placement</p>
                    <p className="text-sm text-muted-foreground">
                      Fair visibility in search results alongside other top agents
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Shield className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">No Obligation</p>
                    <p className="text-sm text-muted-foreground">
                      Completely free, no credit card required, cancel anytime
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Next Steps */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">
                Next Step: Confirm Your Facts
              </h3>
              <p className="text-muted-foreground mb-6">
                Take 2 minutes to review and update your profile information. 
                You'll also see options to expand your reach with premium features (optional).
              </p>
              
              <Button 
                onClick={handleContinue}
                size="lg"
                className="w-full md:w-auto"
              >
                Confirm My Facts →
              </Button>
            </div>
          </div>
        </Card>

        {/* Footer Note */}
        <p className="text-center text-sm text-muted-foreground mt-8">
          Questions? Email us at{' '}
          <a href="mailto:hello@top10lists.us" className="text-primary hover:underline">
            hello@top10lists.us
          </a>
        </p>
      </div>
    </div>
  );
}