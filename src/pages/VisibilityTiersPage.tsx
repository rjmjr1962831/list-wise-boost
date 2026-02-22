import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SafeHead } from '@/components/SafeHead';
import { Loader2, BadgeCheck, Shield, Zap, ArrowLeft } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentUser } from '@/lib/adminAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/** Normalize tier for display. Dashboard = at least Certified; map listed/unknown to certified. */
function normalizeTier(t: string | null): string {
  const t0 = (t || '').toLowerCase();
  if (t0 === 'accredited' || t0 === 'audited') return 'audited';
  if (t0 === 'underwritten') return 'underwritten';
  return 'certified'; // listed, null, empty, or any other value = Certified (dashboard minimum)
}

/** Estimate AICS using tier lift model when no projection exists */
function estimateAICS(
  base: number | null,
  currentTier: string,
  targetTier: string
): number | null {
  // Tier lift ranges from master doc: Listed +3-5, Certified +8-14, Audited +19-27, Underwritten +29-37
  const lift: Record<string, number> = {
    listed: 4,
    certified: 11,
    audited: 23,
    underwritten: 33,
  };
  const baseScore = base ?? 55;
  const targetLift = lift[targetTier] ?? 11;
  return Math.min(100, Math.round(baseScore - (lift[currentTier] ?? 11) + targetLift));
}

interface TierConfig {
  id: string;
  name: string;
  price: string;
  icon: typeof BadgeCheck;
  features: string[];
}

const TIERS: TierConfig[] = [
  {
    id: 'certified',
    name: 'Certified',
    price: 'Free',
    icon: BadgeCheck,
    features: [
      'Standard Top10Lists badge',
      'Standard artifact, monthly refresh',
      'Core credentials published to AI systems',
    ],
  },
  {
    id: 'audited',
    name: 'Audited',
    price: '$100/mo',
    icon: Shield,
    features: [
      'Richer data payload',
      'Every Two Weeks refresh',
      'Community involvement, transaction stats',
    ],
  },
  {
    id: 'underwritten',
    name: 'Underwritten',
    price: '$150/mo',
    icon: Zap,
    features: [
      'Maximum data richness',
      'Daily refresh',
      'Full neighborhood endorsement',
    ],
  },
];

export default function VisibilityTiersPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const isDashboard = returnTo === 'dashboard';

  const [loading, setLoading] = useState(true);
  const [isAnnual, setIsAnnual] = useState(false);
  const [professional, setProfessional] = useState<{
    id: string;
    name: string;
    current_tier: string | null;
    badge_tier?: string | null;
    signal_score: number | null;
    certified_projected_signal: number | null;
    audited_projected_signal: number | null;
    verification_token: string | null;
  } | null>(null);

  useEffect(() => {
    if (!isDashboard) {
      navigate('/agent/dashboard');
      return;
    }

    const sessionToken = localStorage.getItem('agent_session_token');
    const professionalIdFromStorage = sessionStorage.getItem('visibility_professional_id');
    const professionalIdFromUrl = searchParams.get('id');

    (async () => {
      setLoading(true);
      try {
        let professionalId: string | null = null;

        if (sessionToken) {
          const { data } = await supabase.functions.invoke('validate-agent-session', {
            body: { sessionToken },
          });
          if (data?.valid) {
            professionalId = data.professionalId;
          }
        }

        // If agent session failed or missing, check if admin is signed in – do not re-prompt for credentials
        if (!professionalId) {
          const adminUser = await getCurrentUser();
          if (adminUser && (professionalIdFromStorage || professionalIdFromUrl)) {
            professionalId = professionalIdFromStorage || professionalIdFromUrl;
          }
        }

        if (!professionalId) {
          navigate('/agent/login');
          return;
        }

        const { data: prof, error } = await supabase
          .from('professionals')
          .select('id, name, current_tier, badge_tier, signal_score, certified_projected_signal, audited_projected_signal, verification_token')
          .eq('id', professionalId)
          .single();

        if (error || !prof) {
          navigate('/agent/dashboard');
          return;
        }
        setProfessional(prof);
      } catch {
        navigate('/agent/dashboard');
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate, isDashboard, searchParams]);

  // Dashboard = at least Certified; default to certified when null/listed/unknown
  const rawTier = professional?.current_tier || professional?.badge_tier || null;
  const currentTier = normalizeTier(rawTier);
  const baseScore = professional?.signal_score ?? professional?.certified_projected_signal ?? null;

  const getAICS = (tierId: string): number | null => {
    if (!professional) return null;
    if (tierId === 'certified')
      return professional.certified_projected_signal ?? professional.signal_score ?? estimateAICS(baseScore, currentTier, 'certified');
    if (tierId === 'audited')
      return professional.audited_projected_signal ?? 79;
    if (tierId === 'underwritten')
      return 98; // per PayloadSection
    return null;
  };

  const handleUpgrade = (tierId: string) => {
    const token = professional?.verification_token || professional?.id;
    if (token && (tierId === 'audited' || tierId === 'underwritten')) {
      navigate(`/funnel/${token}/pricing`);
    }
  };

  const handleBack = () => {
    navigate('/agent/dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <SafeHead>
        <title>Upgrade Your Tier | Top10Lists</title>
        <meta name="description" content="Upgrade to increase your AI Citability Score. Compare Certified, Audited, and Underwritten tiers." />
        <meta name="robots" content="noindex, nofollow" />
      </SafeHead>

      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Button variant="ghost" size="sm" onClick={handleBack} className="mb-6 -ml-2">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="mb-8">
          <h1 className="text-2xl font-bold">Upgrade Your Tier</h1>
          <p className="text-muted-foreground mt-1">
            Higher tiers increase your AI Citability Score. Payment never affects inclusion or ranking.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {TIERS.map((tier) => {
            const Icon = tier.icon;
            const isCurrent = currentTier === tier.id;
            const aics = getAICS(tier.id);
            const isPaid = tier.id === 'audited' || tier.id === 'underwritten';

            return (
              <Card
                key={tier.id}
                className={`relative ${tier.id === 'audited' ? 'pt-6' : ''} ${isCurrent ? 'border-primary ring-2 ring-primary/20' : ''}`}
              >
                {tier.id === 'audited' && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}
                <CardHeader className="pb-2">
                  {isCurrent && (
                    <p className="text-sm font-semibold text-primary mb-2">You are on this tier</p>
                  )}
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{tier.name}</CardTitle>
                  </div>
                  <p className="text-2xl font-bold text-foreground mt-1">{tier.price}</p>
                  <div className="flex items-center justify-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                    <Label htmlFor={`billing-${tier.id}`} className="text-xs">Monthly</Label>
                    <Switch id={`billing-${tier.id}`} checked={isAnnual} onCheckedChange={setIsAnnual} />
                    <Label htmlFor={`billing-${tier.id}`} className="text-xs">Annual (2 mo free)</Label>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      AI Citability Score
                    </p>
                    <p className="text-xl font-bold">
                      {aics != null ? `${aics}/100` : 'Pending'}
                    </p>
                  </div>

                  <ul className="text-sm text-muted-foreground space-y-1">
                    {tier.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  {isPaid && !isCurrent && (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => handleUpgrade(tier.id)}
                    >
                      Upgrade to {tier.name}
                    </Button>
                  )}
                  {tier.id === 'certified' && !isCurrent && (
                    <p className="text-xs text-muted-foreground text-center">
                      Free tier
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="text-sm text-muted-foreground mt-6 text-center">
          No one can guarantee that you will be named when an AI is asked for a recommendation. What we can say is that the higher your score, the more likely you are to be cited by name.
        </p>
      </div>
    </>
  );
}
