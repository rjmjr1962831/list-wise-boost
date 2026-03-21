import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { SafeHead } from "@/components/SafeHead";
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { FunnelBreadcrumbs } from '@/components/funnel/FunnelBreadcrumbs';
import { TierPricingCalculator } from '@/components/pricing/TierPricingCalculator';
import { toast } from 'sonner';

type CertificationTier = 'certified' | 'audited' | 'underwritten';

interface Professional {
  id: string;
  name: string;
  email?: string | null;
  current_tier?: string | null;
  badge_tier?: string | null;
  signal_score?: number | null;
}

function normalizeTier(t: string | null | undefined): CertificationTier {
  const t0 = (t || '').toLowerCase();
  if (t0 === 'audited' || t0 === 'accredited') return 'audited';
  if (t0 === 'underwritten') return 'underwritten';
  return 'certified';
}

export default function Step7Pricing() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const passedProfessional = (location.state as { professional?: Professional } | null)?.professional;
  const [loading, setLoading] = useState(true);
  const [savingTier, setSavingTier] = useState<string | null>(null);
  const [professional, setProfessional] = useState<Professional | null>(null);

  useEffect(() => { loadData(); }, [token, passedProfessional]);

  const loadData = async () => {
    if (!token) { navigate('/404'); return; }
    try {
      let prof: Professional | null = null;
      if (passedProfessional) {
        const { data: signals } = await supabase
          .from('professionals')
          .select('email, current_tier, badge_tier, signal_score')
          .eq('id', passedProfessional.id)
          .maybeSingle();
        prof = { ...passedProfessional, ...signals };
      } else {
        const profSelect = 'id, name, email, current_tier, badge_tier, signal_score';
        const isUuid = /^[0-9a-f-]{36}$/i.test(token);
        if (isUuid) {
          const { data } = await supabase.from('professionals').select(profSelect).eq('id', token).maybeSingle();
          prof = data;
        }
        if (!prof) {
          const { data } = await supabase.from('professionals').select(profSelect).eq('verification_token', token).maybeSingle();
          prof = data;
        }
      }
      if (!prof) { navigate('/404'); return; }
      setProfessional(prof);
    } catch {
      navigate('/404');
    } finally {
      setLoading(false);
    }
  };

  const currentTier = normalizeTier(professional?.current_tier ?? professional?.badge_tier);
  const currentAifs = professional?.signal_score ?? 42;

  const handleSelectTier = async (tier: CertificationTier) => {
    if (!token || !professional) return;
    setSavingTier(tier);
    try {
      if (tier === 'certified') {
        const { data, error } = await supabase.functions.invoke('funnel-select-tier', { body: { token, tier: 'certified' } });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast.success('Certified tier activated!');
        navigate(`/funnel/${token}/payment-success`);
      } else {
        const email = professional.email;
        if (!email) { toast.error('Email is required for checkout. Please contact support.'); return; }
        const baseUrl = window.location.origin;
        const { data, error } = await supabase.functions.invoke('create-agent-checkout', {
          body: {
            professionalId: professional.id,
            email,
            badgeTier: tier,
            badgeBillingPeriod: 'monthly',
            monthlyTotal: tier === 'audited' ? 300 : 500,
            successUrl: `${baseUrl}/funnel/${token}/payment-success`,
            cancelUrl: `${baseUrl}/funnel/${token}/pricing`,
          },
        });
        if (error) { console.error('create-agent-checkout error:', error); throw error; }
        if (data?.error) { console.error('create-agent-checkout returned error:', data.error); throw new Error(data.error); }
        if (data?.url) { window.location.href = data.url; }
        else throw new Error('No checkout URL returned');
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
        <title>Choose Your Certification Tier | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="googlebot" content="noindex, nofollow" />
      </SafeHead>

      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 py-10 px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          <FunnelBreadcrumbs currentStep={8} />

          <div className="text-center py-2">
            <h2 className="text-xl font-bold text-white">
              {professional?.name?.split(' ')[0] || 'Agent'}, your verified AIFS is currently{' '}
              <span className="text-emerald-400">{currentAifs}</span>
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Select a tier below to increase your verification depth, data freshness, and the richness of your AI-readable payload.
            </p>
          </div>

          <TierPricingCalculator
            currentTier={currentTier}
            currentAifs={currentAifs}
            onSelectTier={handleSelectTier}
            savingTier={savingTier}
          />

          <p className="text-center text-sm text-slate-500 pb-4">
            Questions? <a href="tel:6027589600" className="underline text-slate-400">(602) 758-9600</a>
          </p>
        </div>
      </div>
    </>
  );
}
