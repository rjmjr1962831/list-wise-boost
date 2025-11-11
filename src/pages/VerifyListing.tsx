import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Building2, Award, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Professional {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  rank: number;
  type: string;
  city_id: string;
  category_id: string;
}

export default function VerifyListing() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfessional = async () => {
      if (!token) {
        setError('Invalid verification link');
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('professionals')
          .select('id, name, title, company, email, phone, website, rank, type, city_id, category_id')
          .eq('verification_token', token)
          .gt('verification_token_expires_at', new Date().toISOString())
          .single();

        if (error || !data) {
          setError('This verification link has expired or is invalid');
          setLoading(false);
          return;
        }

        setProfessional(data as Professional);
      } catch (err) {
        setError('Failed to load listing');
      } finally {
        setLoading(false);
      }
    };

    loadProfessional();
  }, [token]);

  const handleVerify = () => {
    if (!professional) return;
    navigate(`/verify/${token}/details`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading your listing...</p>
        </div>
      </div>
    );
  }

  if (error || !professional) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-destructive">Verification Error</CardTitle>
            <CardDescription>{error || 'Unable to load listing'}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Verify Your Top10Lists Listing</h1>
            <p className="text-xl text-muted-foreground">
              Take control of your professional presence and unlock premium features
            </p>
          </div>

          {/* Benefits */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card>
              <CardHeader>
                <Building2 className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Control Your Profile</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Update your information, specialties, and service areas anytime
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Award className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Verified Badge</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Stand out with a verified professional badge on your listing
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <TrendingUp className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">More Leads</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Verified listings receive 3x more client inquiries
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Your Listing */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Your Current Listing</CardTitle>
              <CardDescription>This is how you appear on Top10Lists</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                        #{professional.rank}
                      </span>
                      <h3 className="text-2xl font-bold">{professional.name}</h3>
                    </div>
                    <p className="text-muted-foreground">{professional.company || 'Company not specified'}</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Listed as: <span className="font-medium capitalize">{professional.type}</span> Real Estate Agent
                    </p>
                  </div>
                </div>
                
                <div className="pt-4 border-t">
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="font-medium text-muted-foreground">Email</dt>
                      <dd>{professional.email || 'Not provided'}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-muted-foreground">Phone</dt>
                      <dd>{professional.phone || 'Not provided'}</dd>
                    </div>
                    {professional.website && (
                      <div>
                        <dt className="font-medium text-muted-foreground">Website</dt>
                        <dd>{professional.website}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing Section - Placeholder */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
              <CardDescription>Choose the plan that works for you</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Pricing details coming soon
              </div>
            </CardContent>
          </Card>

          {/* Verify Button */}
          <div className="text-center">
            <Button size="lg" onClick={handleVerify} className="px-12">
              <CheckCircle2 className="mr-2 h-5 w-5" />
              Verify My Listing
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              Verification takes less than 5 minutes
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
