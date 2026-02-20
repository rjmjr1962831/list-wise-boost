import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { SafeHead } from "@/components/SafeHead";
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Home, Phone, ExternalLink, Copy } from 'lucide-react';
import { toast } from 'sonner';

export default function StepSuccess() {
  const { token } = useParams<{ token: string }>();
  const [artifactUrl, setArtifactUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(true);

  useEffect(() => {
    generateCertification();
  }, [token]);

  const generateCertification = async () => {
    if (!token) return;

    try {
      // Get professional ID and selected cities/neighborhoods from funnel
      const { data: prof, error: profError } = await supabase
        .from('professionals')
        .select('id')
        .eq('verification_token', token)
        .single();

      if (profError || !prof) {
        console.error('Failed to get professional:', profError);
        setGenerating(false);
        return;
      }

      // For now, generate a basic certified tier (free)
      // In production, this would be based on payment tier
      const { data, error } = await supabase.functions.invoke('generate-certification', {
        body: {
          agent_id: prof.id,
          tier: 'certified',
          markets_covered: ['Phoenix'], // TODO: Get from funnel data
          neighborhoods_covered: [],
          verified_transactions: {}
        }
      });

      if (error) {
        console.error('Failed to generate certification:', error);
        toast.error('Failed to generate certification');
      } else if (data?.artifact_url) {
        setArtifactUrl(data.artifact_url);
        toast.success('Certification generated!');
      }
    } catch (err) {
      console.error('Error generating certification:', err);
    } finally {
      setGenerating(false);
    }
  };

  const copyArtifactUrl = () => {
    if (artifactUrl) {
      navigator.clipboard.writeText(artifactUrl);
      toast.success('Artifact URL copied!');
    }
  };

  return (
    <>
      <SafeHead>
        <title>Welcome to Top10Lists! | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="googlebot" content="noindex, nofollow" />
      </SafeHead>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-6">
                <div className="rounded-full bg-green-100 dark:bg-green-900 p-6">
                  <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <CardTitle className="text-3xl">You're All Set!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-center">
              <p className="text-lg text-muted-foreground">
                Congratulations! Your profile is now being processed.
              </p>

              {/* Certification Artifact */}
              {generating && (
                <div className="border rounded-lg p-6 bg-blue-50 dark:bg-blue-950">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Generating your certification artifact...
                  </p>
                </div>
              )}

              {artifactUrl && (
                <div className="border rounded-lg p-6 bg-green-50 dark:bg-green-950">
                  <h3 className="font-semibold text-lg mb-3 text-green-800 dark:text-green-200">
                    Your Certification Artifact is Ready!
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-300 mb-4">
                    This is your machine-readable certification that AI systems can use to cite you.
                  </p>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" className="flex-1">
                      <a href={artifactUrl} target="_blank" rel="noopener">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Artifact
                      </a>
                    </Button>
                    <Button onClick={copyArtifactUrl} variant="outline">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="border rounded-lg p-6 bg-muted/50">
                <h3 className="font-semibold text-lg mb-3">What happens next?</h3>
                <ul className="text-left space-y-2 text-sm">
                  <li className="flex gap-2">
                    <span className="text-primary font-bold">1.</span>
                    <span>Your certification artifact is now live and citable by AI systems</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary font-bold">2.</span>
                    <span>You'll receive an email with your login credentials</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary font-bold">3.</span>
                    <span>Your profile will appear in search results</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary font-bold">4.</span>
                    <span>We'll send you weekly reports on your visibility</span>
                  </li>
                </ul>
              </div>

              <div className="border-t pt-6 space-y-4">
                <p className="text-sm text-muted-foreground">
                  In the meantime, feel free to explore our site or contact us with any questions.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button asChild variant="outline" className="gap-2">
                    <a href="/">
                      <Home className="h-4 w-4" />
                      Go to Homepage
                    </a>
                  </Button>
                  <Button asChild className="gap-2">
                    <a href="tel:6027589600">
                      <Phone className="h-4 w-4" />
                      Call Us: (602) 758-9600
                    </a>
                  </Button>
                </div>
              </div>

              <div className="border-t pt-6">
                <p className="text-xs text-muted-foreground">
                  Check your email for a confirmation and next steps. If you don't see it within 24 hours, please check your spam folder or contact us.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
