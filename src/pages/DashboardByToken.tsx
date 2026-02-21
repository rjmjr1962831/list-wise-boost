import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { SafeHead } from '@/components/SafeHead';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Check, Pencil, ExternalLink, Shield } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const BASE_URL = 'https://www.top10lists.us';

const ACCEPTED_FUNNEL_STATUSES = ['confirmed', 'approved', 'edit_complete'];

interface ProfessionalData {
  id: string;
  name: string;
  company: string | null;
  business_name: string | null;
  image_url: string | null;
  review_stars_rating: number | null;
  num_total_reviews: number | null;
  license_number: string | null;
  specialty: string[] | null;
  short_code: string | null;
  verification_token: string | null;
  funnel_status: string | null;
  paid_cities: unknown;
  monthly_revenue_cents: number | null;
  subscription_status: string | null;
}

function getTierDisplay(p: ProfessionalData): string {
  const revenue = p.monthly_revenue_cents ?? 0;
  const hasPaid = (p.paid_cities && Array.isArray(p.paid_cities) && (p.paid_cities as unknown[]).length > 0) || revenue > 0;
  const sub = (p.subscription_status || '').toLowerCase();
  if (revenue >= 15000 || sub === 'underwritten') return 'Underwritten';
  if (revenue >= 5000 || sub === 'accredited' || sub === 'audited') return 'Audited';
  if (hasPaid || p.funnel_status === 'approved' || p.funnel_status === 'edit_complete') return 'Certified';
  return 'Listed';
}

function hasAcceptedProfile(funnelStatus: string | null): boolean {
  return !!funnelStatus && ACCEPTED_FUNNEL_STATUSES.includes(funnelStatus);
}

/** Listed + not accepted → show confirm card. Certified+ or accepted → go to full agent dashboard. */
function shouldShowConfirmCard(tier: string, funnelStatus: string | null): boolean {
  if (tier !== 'Listed') return false;
  return !hasAcceptedProfile(funnelStatus);
}

export default function DashboardByToken() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<ProfessionalData | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const redirecting = useRef(false);

  const redirectToAgentDashboard = async (t: string): Promise<boolean> => {
    if (redirecting.current) return false;
    redirecting.current = true;
    try {
      const { data: sessionData, error: sessionError } = await supabase.functions.invoke('create-session-from-token', {
        body: { token: t },
      });
      if (!sessionError && sessionData?.success && sessionData?.sessionToken) {
        localStorage.setItem('agent_session_token', sessionData.sessionToken);
        navigate('/agent/dashboard', { replace: true });
        return true;
      }
      return false;
    } finally {
      redirecting.current = false;
    }
  };

  useEffect(() => {
    if (!token) {
      setInvalid(true);
      setLoading(false);
      return;
    }

    const fetchAndLog = async () => {
      try {
        const { data, error } = await supabase
          .from('professionals')
          .select(`
            id, name, company, business_name, image_url,
            review_stars_rating, num_total_reviews, license_number, specialty,
            short_code, verification_token, funnel_status,
            paid_cities, monthly_revenue_cents, subscription_status
          `)
          .eq('verification_token', token)
          .eq('active', true)
          .maybeSingle();

        if (error || !data) {
          setInvalid(true);
          setLoading(false);
          return;
        }

        const tier = getTierDisplay(data);
        const showCard = shouldShowConfirmCard(tier, data.funnel_status);

        if (!showCard) {
          // Certified/Audited/Underwritten, or Listed but already accepted → full agent dashboard
          const redirected = await redirectToAgentDashboard(token);
          setLoading(false);
          if (!redirected) setProfessional(data); // fallback: show card if session failed
          return;
        }

        setProfessional(data);

        // Log visit: set verification_started_at to now
        await supabase
          .from('professionals')
          .update({ verification_started_at: new Date().toISOString() })
          .eq('id', data.id);
      } catch {
        setInvalid(true);
      } finally {
        setLoading(false);
      }
    };

    fetchAndLog();
  }, [token, navigate]);

  const handleConfirmData = async () => {
    if (!professional || confirming) return;
    setConfirming(true);
    try {
      await supabase
        .from('professionals')
        .update({ funnel_status: 'confirmed' })
        .eq('id', professional.id);
      // Accepted → send to full agent dashboard
      await redirectToAgentDashboard(professional.verification_token || token!);
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (invalid || !professional) {
    return (
      <>
        <SafeHead>
          <title>Invalid link | Top10Lists.us</title>
          <meta name="robots" content="noindex, nofollow" />
        </SafeHead>
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">This link has expired or is invalid.</p>
              <Button asChild className="mt-4" variant="outline">
                <Link to="/">Go to Homepage</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  const company = professional.company || professional.business_name || null;
  const tier = getTierDisplay(professional);
  const publicCardUrl = professional.short_code
    ? `${BASE_URL}/p/${professional.short_code}`
    : null;
  const editUrl = `/profile/${professional.verification_token || token}/edit`;

  return (
    <>
      <SafeHead>
        <title>Your professional card | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
      </SafeHead>
      <div className="min-h-screen bg-background py-8 md:py-12">
        <div className="container max-w-2xl mx-auto px-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-2 border-primary/20">
                  <AvatarImage src={professional.image_url || undefined} alt={professional.name} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xl">
                    {professional.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-xl">{professional.name}</CardTitle>
                  {company && <p className="text-muted-foreground text-sm">{company}</p>}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <dl className="grid gap-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Rating</dt>
                  <dd>{professional.review_stars_rating != null ? `${professional.review_stars_rating} stars` : '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Review count</dt>
                  <dd>{professional.num_total_reviews ?? '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">License</dt>
                  <dd>{professional.license_number || '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Specialties</dt>
                  <dd>
                    {professional.specialty?.length
                      ? Array.isArray(professional.specialty)
                        ? (professional.specialty as string[]).join(', ')
                        : String(professional.specialty)
                      : '—'}
                  </dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-muted-foreground flex items-center gap-1">
                    <Shield className="h-4 w-4" /> Tier
                  </dt>
                  <dd>{tier}</dd>
                </div>
              </dl>

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                <Button onClick={handleConfirmData} disabled={confirming} className="flex-1">
                  {confirming ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                  Confirm My Data
                </Button>
                <Button asChild variant="outline" className="flex-1">
                  <Link to={editUrl}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit My Profile
                  </Link>
                </Button>
                {publicCardUrl && (
                  <Button asChild variant="secondary" className="flex-1">
                    <a href={publicCardUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View My Public Card
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
