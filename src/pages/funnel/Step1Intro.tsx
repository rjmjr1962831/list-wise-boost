import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SafeHead } from "@/components/SafeHead";
import { supabase } from '@/integrations/supabase/client';
import { trackFunnelEvent } from '@/lib/funnel-track';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ArrowRight, Eye, TrendingUp, Shield, Zap } from 'lucide-react';
import { FunnelBreadcrumbs } from '@/components/funnel/FunnelBreadcrumbs';

interface Professional {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  verification_token: string | null;
  ai_surfaces_monthly_est: number | null;
  ai_surfaces_7d?: number | null;
  review_stars_rating: number | null;
  num_total_reviews: number | null;
  years_experience: number | null;
  total_sales: number | null;
}

interface AifsData {
  score: number;
  band: string;
  scoreCertified: number | null;
  scoreCertifiedBand: string | null;
  scoreUnderwritten: number | null;
  scoreUnderwrittenBand: string | null;
}

function aifsBand(score: number): string {
  if (score >= 86) return "Authoritative";
  if (score >= 71) return "Recommended";
  if (score >= 51) return "Citable";
  if (score >= 31) return "Discoverable";
  return "Invisible";
}

function aifsBandColor(band: string): string {
  switch (band) {
    case "Authoritative": return "text-primary";
    case "Recommended": return "text-emerald-600";
    case "Citable": return "text-yellow-600";
    case "Discoverable": return "text-orange-500";
    default: return "text-red-500";
  }
}

function aifsBarColor(band: string): string {
  switch (band) {
    case "Authoritative": return "bg-primary";
    case "Recommended": return "bg-emerald-500";
    case "Citable": return "bg-yellow-500";
    case "Discoverable": return "bg-orange-500";
    default: return "bg-red-500";
  }
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

export default function Step1Intro() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [aifs, setAifs] = useState<AifsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadProfessional(); }, [token]);

  const loadProfessional = async () => {
    if (!token) { setError('No token provided'); setLoading(false); return; }

    try {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
      let data: any = null;
      let fetchError: any = null;

      const fields = 'id, name, email, phone, company, verification_token, current_tier, ai_surfaces_monthly_est, review_stars_rating, num_total_reviews, years_experience, total_sales';

      if (isUUID) {
        const byId = await supabase.from('professionals').select(fields).eq('id', token).maybeSingle();
        if (byId.data) { data = byId.data; }
        else {
          const byToken = await supabase.from('professionals').select(fields).eq('verification_token', token).maybeSingle();
          data = byToken.data; fetchError = byToken.error;
        }
      } else {
        const res = await supabase.from('professionals').select(fields).eq('verification_token', token).single();
        data = res.data; fetchError = res.error;
      }

      if (fetchError || !data) { setError('Invalid or expired link'); setLoading(false); return; }

      const tier = (data.current_tier || '').toLowerCase();
      if (['certified', 'audited', 'underwritten'].includes(tier)) {
        navigate(`/dashboard/${data.verification_token || data.id}`, { replace: true });
        return;
      }

      // Fetch 7-day AI surfaces
      try {
        const { data: surfaceRow } = await supabase
          .from('agent_ai_surfaces' as any)
          .select('total_surfaces')
          .eq('agent_id', data.id)
          .maybeSingle();
        if (surfaceRow) data.ai_surfaces_7d = (surfaceRow as any).total_surfaces;
      } catch { /* surfaces not available */ }

      setProfessional(data);
      trackFunnelEvent('funnel_landed', data);
      trackFunnelEvent('funnel_step_intro', data);

      // Fetch AIFS from geo_audit_results
      try {
        const { data: auditRows } = await supabase.rpc('run_sql', {
          query: `SELECT score_listed as score, score_certified, score_underwritten FROM geo_audit_results WHERE agent_id = '${data.id}' LIMIT 1`
        });
        if (auditRows && auditRows[0]?.score) {
          const score = Math.round(auditRows[0].score);
          const sc = auditRows[0].score_certified ? Math.round(auditRows[0].score_certified) : null;
          const su = auditRows[0].score_underwritten ? Math.round(auditRows[0].score_underwritten) : null;
          setAifs({
            score,
            band: aifsBand(score),
            scoreCertified: sc,
            scoreCertifiedBand: sc ? aifsBand(sc) : null,
            scoreUnderwritten: su,
            scoreUnderwrittenBand: su ? aifsBand(su) : null,
          });
        }
      } catch { /* AIFS not available -- that's ok */ }

      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => { navigate(`/funnel/${token}/review-1`); };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
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

  const surfaces = professional.ai_surfaces_7d ?? professional.ai_surfaces_monthly_est ?? 0;
  const score = aifs?.score ?? null;
  const band = aifs?.band ?? null;
  const firstName = professional.name.split(' ')[0];

  return (
    <>
      <SafeHead>
        <title>Your AI Footprint | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
      </SafeHead>

      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
          <FunnelBreadcrumbs currentStep={1} />

          {/* ═══ Hero: Their name + what's happening ═══ */}
          <div className="text-center mt-6 mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
              {firstName}, AI is already seeing you.
            </h1>
          </div>

          {/* ═══ Stats row ═══ */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <Eye className="h-5 w-5 text-primary mx-auto mb-1 opacity-70" />
              <div className="text-2xl sm:text-3xl font-bold text-white">
                {surfaces > 0 ? fmt(surfaces) : "--"}
              </div>
              <div className="text-xs text-slate-400 mt-1">AI Surfaces / 7 Days</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Times AI saw your name</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <TrendingUp className="h-5 w-5 text-primary mx-auto mb-1 opacity-70" />
              <div className={`text-2xl sm:text-3xl font-bold ${score !== null ? aifsBandColor(band!) : 'text-white'}`}>
                {score !== null ? score : "--"}
              </div>
              <div className="text-xs text-slate-400 mt-1">Your AIFS Today</div>
              {band && <div className={`text-[10px] mt-0.5 font-semibold ${aifsBandColor(band)}`}>{band}</div>}
              <div className="text-[10px] text-slate-500 mt-0.5">
                {(score ?? 0) < 31 && "Not named"}
                {(score ?? 0) >= 31 && (score ?? 0) < 51 && "Rarely named"}
                {(score ?? 0) >= 51 && (score ?? 0) < 71 && "Named once in a while"}
                {(score ?? 0) >= 71 && (score ?? 0) < 86 && "Named often"}
                {(score ?? 0) >= 86 && "Named regularly"}
              </div>
              <div className="text-[10px] text-slate-500">
                {(score ?? 0) < 51 && "Endorsement: unlikely"}
                {(score ?? 0) >= 51 && (score ?? 0) < 71 && "Endorsement: hedged"}
                {(score ?? 0) >= 71 && (score ?? 0) < 86 && "Endorsement: positive"}
                {(score ?? 0) >= 86 && "Endorsement: confident"}
              </div>
            </div>
            {aifs?.scoreUnderwritten && aifs.scoreUnderwritten > (score ?? 0) && (
              <div className="bg-white/5 border border-emerald-500/30 rounded-xl p-4 text-center">
                <Zap className="h-5 w-5 text-emerald-400 mx-auto mb-1 opacity-70" />
                <div className={`text-2xl sm:text-3xl font-bold ${aifsBandColor(aifs.scoreUnderwrittenBand!)}`}>
                  {aifs.scoreUnderwritten}
                </div>
                <div className="text-xs text-slate-400 mt-1">Your AIFS Potential</div>
                <div className={`text-[10px] mt-0.5 font-semibold ${aifsBandColor(aifs.scoreUnderwrittenBand!)}`}>{aifs.scoreUnderwrittenBand}</div>
                <div className="text-[10px] text-emerald-400/80 mt-0.5">
                  {aifs.scoreUnderwritten! < 51 && "Rarely named"}
                  {aifs.scoreUnderwritten! >= 51 && aifs.scoreUnderwritten! < 71 && "Named once in a while"}
                  {aifs.scoreUnderwritten! >= 71 && aifs.scoreUnderwritten! < 86 && "Named often"}
                  {aifs.scoreUnderwritten! >= 86 && "Named regularly"}
                </div>
                <div className="text-[10px] text-emerald-400/80">
                  {aifs.scoreUnderwritten! < 51 && "Endorsement: unlikely"}
                  {aifs.scoreUnderwritten! >= 51 && aifs.scoreUnderwritten! < 71 && "Endorsement: hedged"}
                  {aifs.scoreUnderwritten! >= 71 && aifs.scoreUnderwritten! < 86 && "Endorsement: positive"}
                  {aifs.scoreUnderwritten! >= 86 && "Endorsement: confident"}
                </div>
              </div>
            )}
          </div>

          {/* ═══ AIFS Explainer ═══ */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6">
            <p className="text-sm text-slate-300 leading-relaxed mb-3">
              Your <strong className="text-white">AI Footprint Score (AIFS)</strong> measures how much verified, citable evidence exists about you <strong className="text-white">across the entire internet</strong> -- not just our site. The more verified evidence they can find, the safer they feel. A higher AIFS means less risk for the AI, which means more comfort recommending or endorsing you. <strong className="text-white">No other site on the internet can lift your AIFS as much as we do.</strong>
            </p>
            {score !== null && (
              <p className="text-sm text-slate-300 leading-relaxed">
                {score < 51 && "At your current level, there isn't enough verified evidence for AI to feel confident including you. Most gaps are fixable."}
                {score >= 71 && "There's a strong body of verified evidence available. AI systems have what they need to feel safe including you in local recommendations."}
              </p>
            )}
          </div>


          {/* ═══ The ask ═══ */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-8">
            <h2 className="text-sm font-semibold text-white mb-2">The Next Step</h2>
            <p className="text-sm text-slate-300 leading-relaxed mb-1">
              To increase your AIFS, you need to <strong className="text-white">verify or edit the data we have compiled</strong>.
            </p>
          </div>

          {/* ═══ CTA ═══ */}
          <div className="text-center space-y-3">
            <Button onClick={handleContinue} size="lg" className="gap-2 w-full sm:w-auto text-lg px-8 py-6">
              See What AI Knows About You
              <ArrowRight className="h-5 w-5" />
            </Button>
            <p className="text-xs text-slate-500">
              Questions? <a href="tel:6027589600" className="underline text-slate-400">(602) 758-9600</a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
