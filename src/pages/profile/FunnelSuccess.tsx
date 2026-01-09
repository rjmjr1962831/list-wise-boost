import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { 
  CheckCircle2, 
  ExternalLink, 
  MapPin, 
  Eye,
  Shield
} from 'lucide-react';

export default function FunnelSuccess() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  // Fetch professional and city data - try verification_token first, then id
  const { data: professional } = useQuery({
    queryKey: ['professional-success', token],
    queryFn: async () => {
      // First try verification_token
      let { data, error } = await supabase
        .from('professionals')
        .select('id, name, city_id, cities(name)')
        .eq('verification_token', token)
        .maybeSingle();
      
      // If not found, try by id
      if (!data && token) {
        const result = await supabase
          .from('professionals')
          .select('id, name, city_id, cities(name)')
          .eq('id', token)
          .maybeSingle();
        data = result.data;
        error = result.error;
      }
      
      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });

  const cityName = (professional?.cities as { name: string } | null)?.name || 'your selected city';

  const handleExploreOptions = () => {
    // Store professional context for visibility funnel
    if (professional?.id) {
      sessionStorage.setItem('visibility_professional_id', professional.id);
    }
    if (token) {
      sessionStorage.setItem('visibility_professional_token', token);
    }
    navigate('/visibility/coverage');
  };

  const handleViewProfile = () => {
    // Navigate to the public agent profile
    navigate(`/profile/${token}`);
  };

  return (
    <>
      <Helmet>
        <title>Your Profile Is Live | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-b from-background to-muted">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto">
            
            {/* Confirmation Section */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
                <CheckCircle2 className="h-10 w-10 text-primary" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-4">
                Your Profile Is Live
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-3">
                Your Top10Lists.us profile is now live and visible to consumers searching for top agents in {cityName}.
              </p>
              <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                Your inclusion and editorial review are based on merit and publicly available data. Rankings and inclusion are never sold.
              </p>
            </div>

            {/* What Happens Next */}
            <Card className="mb-8">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4">What Happens Next</h2>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    Your profile will continue to appear to consumers as-is. You can return at any time to update optional details or review performance insights.
                  </p>
                  <p>
                    No action is required to remain listed in {cityName}.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Next Step: Select Your Cities */}
            <Card className="mb-8 border-primary">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4">Next: Select Your Coverage Areas</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Now that your profile is live, choose the cities and neighborhoods where you'd like to be featured. Your primary city listing is free—additional areas are optional.
                </p>
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <MapPin className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">City Coverage</p>
                      <p className="text-sm text-muted-foreground">
                        Select the cities where you work. Your primary city is included free.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <Eye className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Neighborhood Expertise</p>
                      <p className="text-sm text-muted-foreground">
                        Highlight specific neighborhoods where you have deep expertise.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Business Model Explanation */}
            <Card className="mb-8">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4">How Top10Lists.us Works</h2>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    Top10Lists.us is a merit-based directory. Qualified professionals are included and reviewed editorially at no cost.
                  </p>
                  <p>
                    We do not sell rankings, endorsements, or editorial placement.
                  </p>
                  <p>
                    To support the platform, we offer optional paid features that expand visibility and provide additional tools, without affecting editorial review or ranking eligibility.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Call to Actions */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              <Button
                size="lg"
                onClick={handleExploreOptions}
                className="w-full sm:w-auto"
              >
                Continue to City Selection
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={handleViewProfile}
                className="w-full sm:w-auto"
              >
                View My Public Profile
              </Button>
            </div>

            {/* Trust Reinforcement Footer */}
            <div className="text-center border-t pt-6">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                <p>
                  Top10Lists.us operates independently. Payment does not influence inclusion, ranking, or editorial judgment.
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
