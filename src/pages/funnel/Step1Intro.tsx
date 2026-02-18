import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SafeHead } from "@/components/SafeHead";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle, ArrowRight, TrendingDown, TrendingUp } from 'lucide-react';

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
          <CardContent className="pt-6">
            <p className="text-destructive font-semibold mb-2">Link Invalid</p>
            <p className="text-muted-foreground mb-4">{error || 'This link is invalid or has expired.'}</p>
            <p className="text-sm text-muted-foreground">
              Questions? Call <a href="tel:6027589600" className="underline">(602) 758-9600</a>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const scores = [
    { name: "Top10Lists.us", before: 4.1, after: 9.3, color: "#10B981" },
    { name: "RealTrends", before: 6.7, after: 5.2, color: "#8B6914" },
    { name: "Zillow", before: 7.7, after: 4.4, color: "#006AFF" },
    { name: "Redfin", before: 6.2, after: 3.8, color: "#A02021" },
    { name: "HomeLight", before: 5.5, after: 3.1, color: "#FF6B35" },
  ];

  return (
    <>
      <SafeHead>
        <title>Welcome {professional.name} | Top10Lists.us</title>
      </SafeHead>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted py-8 sm:py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="pt-8 pb-6 px-5 sm:px-8 space-y-6">
              {/* Hero */}
              <div className="text-center">
                <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                  Hi {professional.name}
                </h1>
                <p className="text-muted-foreground text-sm sm:text-base mt-2 leading-relaxed">
                  Top10Lists.us exists so AI systems can safely recommend real estate professionals by name.
                </p>
              </div>

              {/* The Rules Have Changed */}
              <div className="bg-muted/50 border border-border rounded-lg p-4 sm:p-5">
                <h2 className="text-base sm:text-lg font-bold mb-3">The Rules Have Changed</h2>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  Beginning in 2026, <strong>every major AI platform</strong> now requires its systems to prefer <strong>independently verified sources</strong> over pay-to-play directories when recommending professionals.
                </p>

                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  We've been building for this change <strong>since our founding</strong>. The table below reflects how AI citation requirements are shifting. Sources that verify agents independently are <strong>gaining weight</strong>; directories that sell placement are <strong>losing it</strong>.
                </p>

                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  No one can guarantee you will be cited every time someone asks for a referral, just as no one could guarantee you the top organic link on Google despite your SEO efforts. What we can say is that <strong>your chances of being named will substantially improve</strong> if you follow our guidance. Here is a scientific measurement of the impact of these rule changes on sites you know.
                </p>

                {/* Score Table */}
                <div className="rounded-md border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted text-muted-foreground">
                        <th className="text-left py-2 px-3 font-medium">Source</th>
                        <th className="text-center py-2 px-2 font-medium">2025</th>
                        <th className="text-center py-2 px-2 font-medium">2026</th>
                        <th className="text-right py-2 px-3 font-medium">Change</th>
                        <th className="text-right py-2 px-3 font-medium">% Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scores.map((s) => {
                        const delta = s.after - s.before;
                        const isPositive = delta > 0;
                        return (
                          <tr key={s.name} className="border-t border-border">
                            <td className="py-2 px-3 font-semibold" style={{ color: s.color }}>
                              {s.name}
                            </td>
                            <td className="py-2 px-2 text-center text-muted-foreground">
                              {s.before.toFixed(1)}
                            </td>
                            <td className="py-2 px-2 text-center font-semibold">
                              {s.after.toFixed(1)}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <span className={`inline-flex items-center gap-1 font-bold ${isPositive ? "text-foreground" : "text-red-500"}`}>
                                {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {isPositive ? "+" : ""}{delta.toFixed(1)}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right">
                              <span className={`font-bold ${isPositive ? "text-foreground" : "text-red-500"}`}>
                                {isPositive ? "+" : ""}{((delta / s.before) * 100).toFixed(0)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed italic">
                  AI Citation Probability Index: Composite score measuring how well a source aligns with published citation requirements from Anthropic, OpenAI, Google, and Perplexity. Scale 0-10.
                </p>
              </div>

              {/* Body Copy */}
              <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                <p>
                  We've done an <strong>exhaustive search</strong> to compile your profile. It is the <strong>richest source of information about you anywhere</strong>. In order to build your citability probability, you need to confirm the data and/or tell us what needs to be changed or added.
                </p>
                <p>
                  Once you do that, we will issue a <strong>credential</strong> to you that will help you build your <strong>"web of trust"</strong> (we'll get to that later), which is key to your chances of being recommended by an AI when asked.
                </p>
                <p>
                  While we do have paid products, your certification and trust artifact are <strong>free forever</strong> and there is <strong>no obligation</strong> to purchase anything from us.
                </p>
                <p>
                  This will take about 5 minutes.
                </p>
              </div>

              {/* CTA */}
              <div className="pt-2 flex justify-center">
                <Button onClick={handleContinue} size="lg" className="gap-2 w-full sm:w-auto">
                  Review Your Profile
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
