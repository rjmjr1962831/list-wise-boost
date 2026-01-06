import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  CheckCircle2, 
  ExternalLink, 
  MapPin, 
  BarChart3, 
  RefreshCw, 
  Eye,
  Shield
} from 'lucide-react';

export default function FunnelSuccess() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const handleExploreOptions = () => {
    navigate(`/profile/${token}/pricing`);
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
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-6">
                <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-4">
                Your Profile Is Live
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-3">
                Your Top10Lists.us profile is now live and visible to consumers searching for top agents in your selected city.
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
                    No action is required to remain listed.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Optional Visibility Features */}
            <Card className="mb-8">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4">Optional Ways to Expand Your Presence</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Some professionals choose to expand their visibility or access additional tools. These options are entirely optional and do not affect inclusion or ranking.
                </p>
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <MapPin className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Additional Cities</p>
                      <p className="text-sm text-muted-foreground">
                        Be featured in more than one city beyond your initial selection.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <Eye className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Enhanced Profile Visibility</p>
                      <p className="text-sm text-muted-foreground">
                        Highlight your profile in comparison views and category browsing.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Insights & Performance Analytics</p>
                      <p className="text-sm text-muted-foreground">
                        See how users interact with your profile.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <RefreshCw className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Ongoing Editorial Updates</p>
                      <p className="text-sm text-muted-foreground">
                        Request periodic refresh reviews as your career evolves.
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4 text-center">
                  Declining these options does not affect your current listing.
                </p>
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
                Explore Visibility Options
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
