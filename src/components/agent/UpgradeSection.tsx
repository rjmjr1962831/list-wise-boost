import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TierPricingCalculator } from '@/components/pricing/TierPricingCalculator';
import { toast } from 'sonner';

type CertificationTier = 'certified' | 'audited' | 'underwritten';

function normalizeTier(t: string | null | undefined): CertificationTier {
  const t0 = (t || '').toLowerCase();
  if (t0 === 'audited' || t0 === 'accredited') return 'audited';
  if (t0 === 'underwritten') return 'underwritten';
  return 'certified';
}

interface UpgradeSectionProps {
  professional: {
    id: string;
    verification_token?: string;
    name?: string;
    email?: string | null;
    current_tier?: string | null;
    badge_tier?: string | null;
    signal_score?: number | null;
  };
}

export function UpgradeSection({ professional }: UpgradeSectionProps) {
  const [savingTier, setSavingTier] = useState<string | null>(null);
  const token = professional.verification_token || professional.id;
  const currentTier = normalizeTier(professional.current_tier ?? professional.badge_tier);
  const currentAifs = professional.signal_score ?? 42;

  const handleSelectTier = async (tier: CertificationTier) => {
    setSavingTier(tier);
    try {
      if (tier === 'certified') {
        const { data, error } = await supabase.functions.invoke('funnel-select-tier', { body: { token, tier: 'certified' } });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast.success('Certified tier activated!');
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
            successUrl: `${baseUrl}/agent/dashboard?section=upgrade&upgraded=${tier}`,
            cancelUrl: `${baseUrl}/agent/dashboard?section=upgrade`,
          },
        });
        if (error) { console.error('create-agent-checkout error:', error); throw error; }
        if (data?.error) throw new Error(data.error);
        if (data?.url) { window.location.href = data.url; }
        else throw new Error('No checkout URL returned');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start checkout';
      toast.error(msg);
    } finally {
      setSavingTier(null);
    }
  };

  return (
    <div className="py-6">
      <TierPricingCalculator
        currentTier={currentTier}
        currentAifs={currentAifs}
        onSelectTier={handleSelectTier}
        savingTier={savingTier}
      />
    </div>
  );
}
