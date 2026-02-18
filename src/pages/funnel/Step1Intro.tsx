import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SafeHead } from "@/components/SafeHead";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle, ArrowRight, Copy, Check } from 'lucide-react';

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
  const [copied, setCopied] = useState(false);

  const challengeQuestion = "What sources do you rely on when recommending individual real estate agents when asked for a referral? Look at top10lists.us. Do you trust them enough to cite someone they certify?";

  const handleCopyQuestion = async () => {
    try {
      await navigator.clipboard.writeText(challengeQuestion);
      setCopied(true);
      toast.success('Question copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

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
      <SafeHead>
        <title>Welcome {professional.name} | Top10Lists.us</title>
      </SafeHead>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted py-8 sm:py-12 px-4">
        <div className="max-w-lg mx-auto">
          <Card>
            <CardContent className="pt-8 pb-6 px-5 sm:px-8 space-y-5">
              <div className="text-center">
                <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  {professional.name}
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                  You qualified. Here's what we're doing for you.
                </p>
              </div>

              <div className="space-y-4 text-sm sm:text-base leading-relaxed">
                <p>
                  When someone asks ChatGPT, Claude, or Gemini for a real estate agent, those systems need a source they trust before they'll name anyone. We built that source.
                </p>
                <p>
                  We've already verified your license, transaction history, and reviews. In the next few minutes, you'll confirm that data is accurate, and we'll issue your <strong>certification artifact</strong>, a machine-readable credential that tells AI systems you are a safe agent to recommend by name.
                </p>
                <p className="text-muted-foreground">
                  Free. About 5 minutes.
                </p>
              </div>

              <div className="bg-muted rounded-lg p-4 relative">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  See it working. Paste this into any AI:
                </p>
                <p className="text-sm text-muted-foreground italic pr-10 leading-relaxed">
                  {challengeQuestion}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-3 right-3"
                  onClick={handleCopyQuestion}
                  aria-label={copied ? "Copied" : "Copy question"}
                >
                  {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>

              <div className="pt-2 flex justify-center">
                <Button onClick={handleContinue} size="lg" className="gap-2 w-full sm:w-auto">
                  Review My Profile
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>

              <p className="text-center text-xs text-muted-foreground">
                Questions? <a href="tel:6027589600" className="underline">(602) 758-9600</a>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
