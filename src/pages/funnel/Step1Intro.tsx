import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, ArrowRight } from 'lucide-react';

interface Professional {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  verification_token: string | null;
}

export default function Step1Intro() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProfessional();
  }, [token]);

  const loadProfessional = async () => {
    if (!token) {
      setError('No token provided');
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('professionals')
        .select('id, name, email, phone, company, verification_token')
        .eq('verification_token', token)
        .single();

      if (fetchError || !data) {
        setError('Invalid or expired link');
        setLoading(false);
        return;
      }

      setProfessional(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    navigate(`/funnel/${token}/review-1`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !professional) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-destructive">Link Invalid</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{error || 'This link is invalid or has expired.'}</p>
            <p className="text-sm text-muted-foreground">
              Questions? Call <a href="tel:6027589600" className="underline">(602) 758-9600</a>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Welcome {professional.name} | Top10Lists.us</title>
      </Helmet>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
              <CardTitle className="text-3xl">Welcome, {professional.name}!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="prose prose-sm max-w-none">
                <p className="text-lg">
                  Thank you for being part of Top10Lists.us. We're here to help you get noticed by potential clients.
                </p>
                
                <h3 className="text-xl font-semibold mt-6 mb-3">What happens next:</h3>
                <ol className="space-y-3">
                  <li>
                    <strong>Review your profile</strong> - We'll show you the information we have about you
                  </li>
                  <li>
                    <strong>Update if needed</strong> - Make any corrections or additions
                  </li>
                  <li>
                    <strong>Choose your coverage</strong> - Select which cities and neighborhoods you serve
                  </li>
                  <li>
                    <strong>Select your tier</strong> - Pick the level of visibility that works for you
                  </li>
                </ol>

                <p className="mt-6">
                  This should only take <strong>5-10 minutes</strong> to complete.
                </p>
              </div>

              <div className="pt-6 flex justify-center">
                <Button onClick={handleContinue} size="lg" className="gap-2">
                  Let's Get Started
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>

              <p className="text-center text-sm text-muted-foreground">
                Questions? Call us at <a href="tel:6027589600" className="underline">(602) 758-9600</a>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
