import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { SafeHead } from "@/components/SafeHead";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Mail, Loader2, Shield, Zap, ArrowRight, BarChart3, RefreshCw, Globe, Link2, Send, X, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProfessionalInfo {
  name: string;
  badge_tier: string | null;
  profile_link: string | null;
  verification_token: string | null;
  id: string;
}

interface AifsInfo {
  aifs_total: number | null;
}

const TIER_META: Record<string, { name: string; icon: typeof Shield; color: string; refresh: string; badgeSrc: string }> = {
  certified: {
    name: 'Certified',
    icon: CheckCircle2,
    color: 'text-blue-400',
    refresh: 'every 90 days',
    badgeSrc: '/badges/certified.png',
  },
  audited: {
    name: 'Audited',
    icon: Shield,
    color: 'text-blue-400',
    refresh: 'every 30 days',
    badgeSrc: '/badges/audited.png',
  },
  underwritten: {
    name: 'Underwritten',
    icon: Zap,
    color: 'text-amber-400',
    refresh: 'daily',
    badgeSrc: '/badges/underwritten.png',
  },
};

function bandLabel(score: number): string {
  if (score <= 35) return 'Invisible';
  if (score <= 65) return 'Fragmented';
  if (score <= 85) return 'Recognized';
  return 'High Fidelity';
}

function bandColor(score: number): string {
  if (score <= 35) return 'text-red-400';
  if (score <= 65) return 'text-orange-400';
  if (score <= 85) return 'text-blue-400';
  return 'text-green-400';
}

export default function AgentPaymentSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const professionalId = searchParams.get('professional_id');
  const isTestMode = professionalId === 'test-admin-checkout';

  const [isProcessing, setIsProcessing] = useState(!isTestMode);
  const [isComplete, setIsComplete] = useState(isTestMode);
  const [error, setError] = useState<string | null>(null);
  const [professional, setProfessional] = useState<ProfessionalInfo | null>(
    isTestMode ? { name: 'Test Agent', badge_tier: 'audited', profile_link: null, verification_token: 'test', id: 'test' } : null
  );
  const [aifs, setAifs] = useState<AifsInfo | null>(
    isTestMode ? { aifs_total: 58 } : null
  );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Fetch professional info + AIFS after subscription completes
  useEffect(() => {
    async function fetchProfessional() {
      if (!professionalId || isTestMode) return;
      try {
        const { data } = await supabase
          .from('professionals')
          .select('id, name, badge_tier, profile_link, verification_token')
          .eq('id', professionalId)
          .maybeSingle();
        if (data) setProfessional(data);

        const { data: aifsRow } = await supabase
          .from('aifs_scores' as any)
          .select('aifs_total')
          .eq('agent_id', professionalId)
          .maybeSingle();
        if (aifsRow) setAifs(aifsRow as unknown as AifsInfo);
      } catch (err) {
        console.error('Error fetching professional:', err);
      }
    }
    if (isComplete) fetchProfessional();
  }, [isComplete, professionalId, isTestMode]);

  useEffect(() => {
    if (isTestMode) {
      toast.success('Test mode: Showing success page for design review');
      return;
    }

    async function completeSubscription() {
      if (!sessionId || !professionalId) {
        setError('Missing payment information');
        setIsProcessing(false);
        return;
      }

      try {
        const { data, error: fnError } = await supabase.functions.invoke('complete-agent-subscription', {
          body: { sessionId, professionalId },
        });

        if (fnError) throw fnError;

        if (data?.success) {
          setIsComplete(true);
          toast.success('Your subscription is now active!');

          if (typeof window.gtag === 'function') {
            window.gtag('event', 'purchase', {
              transaction_id: sessionId,
              currency: 'USD',
              items: [{ item_name: 'Badge Tier Subscription', item_category: 'Subscription' }],
            });
          }
        } else {
          throw new Error(data?.error || 'Subscription completion failed');
        }
      } catch (err: any) {
        console.error('Error completing subscription:', err);
        setError(err.message);
        toast.error('There was an issue completing your subscription. Please contact support.');
      } finally {
        setIsProcessing(false);
      }
    }

    completeSubscription();
  }, [sessionId, professionalId, isTestMode]);

  const tier = professional?.badge_tier?.toLowerCase() || 'audited';
  const meta = TIER_META[tier] || TIER_META.audited;
  const TierIcon = meta.icon;
  const firstName = professional?.name?.split(' ')[0] || 'Agent';
  const hasWebOfTruth = !!professional?.profile_link;
  const aifsScore = aifs?.aifs_total ?? null;
  const artifactToken = professional?.verification_token || professional?.id || professionalId;
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [questionSubmitted, setQuestionSubmitted] = useState(false);

  const handleSubmitQuestion = async () => {
    if (!questionText.trim()) {
      toast.error('Please enter your question.');
      return;
    }
    setSubmittingQuestion(true);
    try {
      const { error: insertErr } = await supabase
        .from('field_change_requests')
        .insert({
          professional_id: professional?.id || professionalId || 'unknown',
          field_name: 'post_purchase_question',
          change_request: questionText.trim(),
          current_value: `Tier: ${tier} | Name: ${professional?.name || 'unknown'}`,
          status: 'pending',
        });
      if (insertErr) throw insertErr;
      setQuestionSubmitted(true);
      toast.success('Question submitted. We\'ll get back to you soon.');
    } catch (err: any) {
      console.error('Error submitting question:', err);
      toast.error(err.message || 'Failed to submit. Please try again.');
    } finally {
      setSubmittingQuestion(false);
    }
  };

  // ── Processing state ──
  if (isProcessing) {
    return (
      <>
        <SafeHead>
          <title>Activating Your Tier... | Top10Lists</title>
        </SafeHead>
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Activating your {meta.name} tier...</h1>
            <p className="text-slate-400">This takes just a moment.</p>
          </div>
        </div>
      </>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <>
        <SafeHead>
          <title>Payment Issue | Top10Lists</title>
        </SafeHead>
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <div className="rounded-full bg-red-500/10 border border-red-500/20 p-6 inline-block mb-6">
              <Mail className="h-12 w-12 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">Something went wrong</h1>
            <p className="text-slate-400 mb-4">
              Your payment was received, but we hit a snag activating your tier.
              Reach out and we'll sort it out immediately.
            </p>
            <a
              href="mailto:hello@top10lists.us"
              className="text-primary underline text-sm"
            >
              hello@top10lists.us
            </a>
            {sessionId && (
              <p className="text-xs text-slate-600 mt-4">Ref: {sessionId}</p>
            )}
            <div className="mt-6">
              <Button asChild variant="outline" className="border-slate-500 text-white hover:bg-slate-800">
                <Link to="/">Return Home</Link>
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Success state ──
  return (
    <>
      <SafeHead>
        <title>{meta.name} Tier Activated | Top10Lists</title>
        <meta name="robots" content="noindex, nofollow" />
      </SafeHead>

      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 py-12 px-4">
        <div className="max-w-2xl mx-auto">

          {/* ── Hero ── */}
          <div className="text-center mb-6">
            <div className="relative inline-block mb-6">
              <div className="rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 p-5">
                <CheckCircle2 className="h-14 w-14 text-emerald-400" />
              </div>
              {/* Badge overlay */}
              <img
                src={meta.badgeSrc}
                alt={`${meta.name} badge`}
                className="absolute -bottom-2 -right-2 h-10 w-auto"
              />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
              {firstName}, your {meta.name} tier is active
            </h1>
            <p className="text-slate-400 text-lg max-w-lg mx-auto">
              AI systems now have access to deeper, fresher evidence about your practice.
            </p>
          </div>

          {/* ── AIFS Score ── */}
          {aifsScore != null && (
            <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-5 mb-6 text-center">
              <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">Your New AIFS</p>
              <div className="flex items-baseline justify-center gap-2">
                <span className={`text-5xl font-black ${bandColor(aifsScore)}`}>{aifsScore}</span>
                <span className="text-lg text-slate-500">/ 95</span>
              </div>
              <p className={`text-sm font-semibold mt-1 ${bandColor(aifsScore)}`}>
                {bandLabel(aifsScore)}
              </p>
            </div>
          )}

          {/* ── Web of Truth CTA ── */}
          {!hasWebOfTruth ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 mb-6">
              <div className="flex justify-center mb-4">
                <img
                  src={`/badges/${tier === "underwritten" ? "underwritten" : tier === "audited" ? "audited" : "certified"}.png`}
                  alt=""
                  style={{ height: 120, width: "auto", animation: "orbPulse 2s ease-in-out infinite" }}
                />
              </div>
              <h3 className="font-semibold text-white mb-2 text-center">Enable your Web of Truth</h3>
              <p className="text-sm text-slate-400 mb-3 text-center">
                Your Web of Truth creates a verified cross-reference chain across the internet.
                Every platform where you place your beacon — your website, Zillow, LinkedIn, Google Business —
                gives AI systems one more independent source to corroborate your credentials.
                Without it, AI has to guess whether scattered mentions refer to you. With it, there's no ambiguity.
              </p>
              <p className="text-sm text-slate-400 mb-4 text-center">
                This is the single highest-leverage action you can take right now to increase your AI citability.
              </p>
              <div className="flex justify-center">
                <Button
                  asChild
                  className="gap-2"
                >
                  <Link to={`/badge-instructions?token=${artifactToken}`}>
                    <Link2 className="h-4 w-4" />
                    Enable Your Web of Truth
                  </Link>
                </Button>
              </div>
              <style>{`@keyframes orbPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.08); opacity: 0.85; } }`}</style>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 mb-6">
              <div className="flex justify-center mb-3">
                <img
                  src={`/badges/${tier === "underwritten" ? "underwritten" : tier === "audited" ? "audited" : "certified"}.png`}
                  alt=""
                  style={{ height: 80, width: "auto", animation: "orbPulse 2s ease-in-out infinite" }}
                />
                <style>{`@keyframes orbPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.08); opacity: 0.85; } }`}</style>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-emerald-400">Web of Truth is active</p>
                <p className="text-xs text-slate-400">Your verified artifact is live and citable by AI systems.</p>
              </div>
            </div>
          )}

          {/* ── What just changed ── */}
          <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-6 mb-6">
            <h2 className="text-lg font-semibold text-white mb-5">What just changed</h2>
            <div className="space-y-5">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <TierIcon className={`h-5 w-5 ${meta.color}`} />
                </div>
                <div>
                  <h3 className="font-medium text-white">{meta.name} verification active</h3>
                  <p className="text-sm text-slate-400">
                    Your profile now carries {meta.name}-level evidence depth. AI systems weight verified, multi-source
                    data higher when making recommendations.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <RefreshCw className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-medium text-white">Data refreshes {meta.refresh}</h3>
                  <p className="text-sm text-slate-400">
                    AI systems trust recent data. Your evidence package will be re-verified on
                    a {meta.refresh} cycle — keeping you current while others go stale.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-medium text-white">AIFS Score uplift begins now</h3>
                  <p className="text-sm text-slate-400">
                    Your AI Footprint Score reflects verification depth, source count, and data freshness.
                    Expect your score to rise within the first refresh cycle.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Globe className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-medium text-white">Richer payload for AI systems</h3>
                  <p className="text-sm text-slate-400">
                    ChatGPT, Claude, Gemini, and Perplexity now receive a deeper evidence package when
                    answering questions about agents in your markets.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── CTA ── */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="gap-2">
              <Link to="/agent/dashboard">
                Go to Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="gap-2 border-slate-500 text-white hover:bg-slate-800"
              onClick={() => setShowQuestionForm(true)}
              disabled={questionSubmitted}
            >
              <MessageCircle className="h-4 w-4" />
              {questionSubmitted ? 'Question submitted' : 'Have a question?'}
            </Button>
          </div>

          {/* ── Question form ── */}
          {showQuestionForm && !questionSubmitted && (
            <div className="mt-6 rounded-xl border border-slate-700 bg-slate-900/80 p-5 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">Send us a question</h3>
                <button type="button" onClick={() => setShowQuestionForm(false)} className="text-slate-500 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="question-text" className="text-xs text-slate-400">Your question *</Label>
                  <textarea
                    id="question-text"
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    placeholder="What would you like to know?"
                    rows={3}
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-slate-500 text-white hover:bg-slate-800"
                    onClick={() => setShowQuestionForm(false)}
                    disabled={submittingQuestion}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSubmitQuestion}
                    disabled={submittingQuestion || !questionText.trim()}
                    className="gap-1"
                  >
                    {submittingQuestion ? (
                      <><Loader2 className="h-3 w-3 animate-spin" /> Sending...</>
                    ) : (
                      <><Send className="h-3 w-3" /> Submit</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {questionSubmitted && (
            <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-emerald-400">We received your question and will get back to you shortly.</p>
            </div>
          )}

          <p className="text-center text-xs text-slate-600 mt-8">
            Need help? Call <a href="tel:6027589600" className="underline text-slate-500">(602) 758-9600</a>
          </p>

        </div>
      </div>
    </>
  );
}
