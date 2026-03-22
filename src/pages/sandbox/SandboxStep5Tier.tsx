import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SafeHead } from '@/components/SafeHead';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useGA4Tracking } from '@/hooks/useGA4Tracking';
import { TierPricingCalculator } from '@/components/pricing/TierPricingCalculator';
import { SandboxNugget } from './SandboxNugget';
import { SandboxProgress } from './SandboxProgress';
import { validateToken } from './utils';

type CertificationTier = 'certified' | 'audited' | 'underwritten';

function normalizeTier(t: string | null | undefined): CertificationTier {
  const t0 = (t || '').toLowerCase();
  if (t0 === 'audited' || t0 === 'accredited') return 'audited';
  if (t0 === 'underwritten') return 'underwritten';
  return 'certified';
}

function getBandLabel(score: number): { label: string; color: string } {
  if (score <= 30) return { label: 'Invisible', color: 'text-red-500' };
  if (score <= 50) return { label: 'Discoverable', color: 'text-orange-500' };
  if (score <= 70) return { label: 'Citable', color: 'text-blue-500' };
  if (score <= 85) return { label: 'Citable Local', color: 'text-sky-400' };
  return { label: 'Authoritative', color: 'text-green-500' };
}

function projectScore(baseline: number, uplift: number): number {
  return Math.min(baseline + uplift, 95);
}

const TIER_UPLIFTS: Record<CertificationTier, number> = {
  certified: 18,
  audited: 28,
  underwritten: 37,
};

export default function SandboxStep5Tier() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { trackEvent } = useGA4Tracking();
  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<any>(null);
  const [savingTier, setSavingTier] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!token) return;
    validateToken(token).then(async (result) => {
      if (result.status !== 'valid' || !result.professional) {
        navigate(`/sandbox/${token}`);
        return;
      }
      // Fetch fresh signal_score and tier
      const { data: fresh } = await supabase
        .from('professionals')
        .select('email, current_tier, badge_tier, signal_score')
        .eq('id', result.professional.id)
        .maybeSingle();
      const prof = { ...result.professional, ...fresh };
      setProfessional(prof);

      const currentAifs = prof.signal_score ?? 24;
      trackEvent('sandbox_step5_tier_view', {
        professional_id: prof.id,
      });
      setLoading(false);
    });
  }, [token]);

  if (loading || !professional) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentTier = normalizeTier(professional.current_tier ?? professional.badge_tier);
  const currentAifs = professional.signal_score ?? 24;
  const currentBand = getBandLabel(currentAifs);

  // Baseline = current score minus current tier's uplift
  const baseline = Math.max(currentAifs - TIER_UPLIFTS[currentTier], 0);
  const auditedProjected = projectScore(baseline, TIER_UPLIFTS.audited);
  const underwrittenProjected = projectScore(baseline, TIER_UPLIFTS.underwritten);
  const auditedBand = getBandLabel(auditedProjected);
  const underwrittenBand = getBandLabel(underwrittenProjected);

  const handleSelectTier = async (tier: CertificationTier) => {
    if (!token || !professional) return;
    trackEvent('sandbox_tier_selected', { professional_id: professional.id });
    setSavingTier(tier);

    try {
      if (tier === 'certified') {
        const { data, error } = await supabase.functions.invoke('funnel-select-tier', {
          body: { token, tier: 'certified' },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        navigate(`/sandbox/${token}/success`, { state: { tier: 'certified' } });
      } else {
        const email = professional.email;
        if (!email) {
          toast.error('Email is required for checkout. Please go back and add your email.');
          setSavingTier(null);
          return;
        }
        const baseUrl = window.location.origin;
        const { data, error } = await supabase.functions.invoke('create-agent-checkout', {
          body: {
            professionalId: professional.id,
            email,
            badgeTier: tier,
            badgeBillingPeriod: 'monthly',
            monthlyTotal: tier === 'audited' ? 300 : 500,
            successUrl: `${baseUrl}/sandbox/${token}/success`,
            cancelUrl: `${baseUrl}/sandbox/${token}/tier`,
          },
        });
        if (error) { console.error('create-agent-checkout error:', error); throw error; }
        if (data?.error) throw new Error(data.error);
        if (data?.url) {
          trackEvent('sandbox_checkout_started', { professional_id: professional.id });
          window.location.href = data.url;
        } else {
          throw new Error('No checkout URL returned');
        }
      }
    } catch (err: unknown) {
      let msg = 'Failed to start checkout';
      if (err && typeof err === 'object') {
        const e = err as { context?: { json?: () => Promise<{ error?: string; details?: string }> }; message?: string };
        if (e.context?.json) {
          try { const body = await e.context.json(); msg = body?.error ?? body?.details ?? e.message ?? msg; }
          catch { msg = e.message ?? msg; }
        } else { msg = e.message ?? msg; }
      }
      toast.error(msg);
    } finally {
      setSavingTier(null);
    }
  };

  return (
    <>
      <SafeHead>
        <title>Choose Your Tier | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
      </SafeHead>

      <div className="min-h-screen bg-background py-10 px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <SandboxProgress currentStep={5} />
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Choose your verification tier.</h1>
            <p className="text-muted-foreground text-sm">
              Every tier includes the same merit-based ranking. Higher tiers give AI systems more reasons to name you.
            </p>
          </div>

          <SandboxNugget>
            AI recommendation is all about trust. The more they trust you, the more likely they are to name or endorse you. Trust is based on independent third-party citations that follow a specific methodology and provide audited data refreshed as often as possible. Each tier below provides more data points, more citations, and more frequent refreshes.
          </SandboxNugget>


          {/* TierPricingCalculator */}
          <TierPricingCalculator
            currentTier={currentTier}
            currentAifs={currentAifs}
            onSelectTier={handleSelectTier}
            savingTier={savingTier}
          />


          <p className="text-center text-sm text-muted-foreground">
            Payment affects verification depth and refresh frequency. It never affects your ranking or inclusion.
          </p>

          {/* Free tier exit */}
          <div className="text-center pt-2">
            <button
              onClick={() => navigate(`/sandbox/${token}/success`, { state: { tier: 'certified' } })}
              className="text-sm text-muted-foreground hover:text-foreground underline transition-colors"
            >
              Stay with your free listing
            </button>
          </div>

          {/* Back navigation */}
          <div className="flex pt-2">
            <Button variant="ghost" onClick={() => navigate(`/sandbox/${token}/neighborhoods`)}>
              Back
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
