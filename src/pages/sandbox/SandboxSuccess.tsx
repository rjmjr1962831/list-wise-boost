import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { SafeHead } from '@/components/SafeHead';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, RotateCcw } from 'lucide-react';
import { useGA4Tracking } from '@/hooks/useGA4Tracking';
import { SandboxNugget } from './SandboxNugget';
import { validateToken, useBasePath } from './utils';

/** Revert a professional back to Listed tier via the edge function */
async function revertToListed(token: string, snapshot: Record<string, any> | null) {
  const updates: [string, any][] = [
    ['phone_visible', true],
    ['email_visible', true],
  ];

  // Restore snapshot fields if we have them
  if (snapshot) {
    if (snapshot.email !== undefined) updates.push(['email', snapshot.email]);
    if (snapshot.phone !== undefined) updates.push(['phone', snapshot.phone]);
    if (snapshot.phone_numbers !== undefined) updates.push(['phone_numbers', snapshot.phone_numbers]);
    if (snapshot.website !== undefined) updates.push(['website', snapshot.website]);
  }

  // Fire all field resets in parallel via edge function
  await Promise.all(
    updates.map(([field, value]) =>
      supabase.functions.invoke('update-professional-field', {
        body: { token, field, value },
      }).catch(() => {})
    )
  );

  // Reset tier back to listed via funnel-select-tier
  await supabase.functions.invoke('funnel-select-tier', {
    body: { token, tier: 'listed' },
  }).catch(() => {
    // Fallback: try certified (the free tier)
    supabase.functions.invoke('funnel-select-tier', {
      body: { token, tier: 'certified' },
    }).catch(() => {});
  });
}

export default function SandboxSuccess() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = useBasePath();
  const { trackEvent } = useGA4Tracking();
  const navState = location.state as { tier?: string } | null;
  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<any>(null);
  const [reverted, setReverted] = useState(false);
  const [reverting, setReverting] = useState(false);

  const tier = navState?.tier || 'certified';

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!token) return;
    validateToken(token).then(async (result) => {
      if (result.status === 'valid' && result.professional) {
        setProfessional(result.professional);
        trackEvent('sandbox_funnel_complete', {
          professional_id: result.professional.id,
        });

        // Auto-revert: restore snapshot and reset to Listed
        const snapshotRaw = sessionStorage.getItem(`sandbox_snapshot_${token}`);
        const snapshot = snapshotRaw ? JSON.parse(snapshotRaw) : null;
        setReverting(true);
        await revertToListed(token, snapshot);
        setReverted(true);
        setReverting(false);
      }
      setLoading(false);
    });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const firstName = professional?.name?.split(' ')[0] || 'Agent';
  const isPaid = tier === 'audited' || tier === 'underwritten';
  const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);

  const profileUrl = professional?.profile_link
    || (professional?.cities?.state_slug && professional?.cities?.slug
      ? `/${professional.cities.state_slug}/${professional.cities.slug}/top10realestateagents`
      : '/');

  return (
    <>
      <SafeHead>
        <title>Success | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
      </SafeHead>

      <div className="min-h-screen bg-background py-10 px-4">
        <div className="max-w-xl mx-auto space-y-6 text-center">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />

          <SandboxNugget>
            AI citation compounds. Each time a system references your profile successfully, it reinforces the pattern. Competitors who start later are catching up to a moving target.
          </SandboxNugget>

          {!isPaid ? (
            <>
              <h1 className="text-2xl font-bold">You're all set, {firstName}.</h1>
              <div className="space-y-4 text-left text-sm text-muted-foreground">
                <p>Your listing is live and AI systems can reference it right now.</p>
                <p>Your profile will be refreshed quarterly to keep your data current.</p>
                <p>You can upgrade your verification tier anytime to give AI systems more data to work with.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                <Button asChild>
                  <a href={profileUrl}>Go to Dashboard</a>
                </Button>
                <Button variant="outline" onClick={() => navigate(`${basePath}/${token}/tier`)}>
                  Explore Upgrade Options
                </Button>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold">Welcome to {tierName}, {firstName}.</h1>
              <div className="space-y-4 text-left text-sm text-muted-foreground">
                {tier === 'audited' ? (
                  <p>
                    Your Audited verification is active. Your profile will be refreshed monthly with expanded verification covering transaction history, community involvement, and career data.
                  </p>
                ) : (
                  <p>
                    Your Underwritten verification is active. Your profile will be refreshed daily with comprehensive verification covering transaction history, community data, press mentions, awards, neighborhood endorsements, and certifications.
                  </p>
                )}
                <p>Your AI Footprint Score will update within 24 hours to reflect your new tier.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                <Button asChild>
                  <a href={profileUrl}>Go to Dashboard</a>
                </Button>
                <Button variant="outline" onClick={() => navigate('/badge-instructions')}>
                  Set Up Your Badge
                </Button>
              </div>
            </>
          )}

          {/* Dev mode: auto-revert + test again */}
          <div className="border-t pt-6 mt-6 space-y-3">
            <div className="inline-flex items-center gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 text-xs text-amber-600">
              {reverting ? (
                <><Loader2 className="h-3 w-3 animate-spin" /> Reverting changes...</>
              ) : reverted ? (
                <><RotateCcw className="h-3 w-3" /> Dev mode: agent reverted to Listed. All changes cleared.</>
              ) : (
                'Dev mode active'
              )}
            </div>
            <div>
              <Button
                variant="outline"
                onClick={() => navigate(`${basePath}/${token}`)}
                disabled={reverting}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Test Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
