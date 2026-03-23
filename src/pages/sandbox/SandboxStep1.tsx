import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SafeHead } from '@/components/SafeHead';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, AlertCircle, Star, MapPin, Shield, Eye } from 'lucide-react';
import { useGA4Tracking } from '@/hooks/useGA4Tracking';
import { SandboxNugget } from './SandboxNugget';
import { validateToken, useBasePath } from './utils';

const HUMAN_BOTS = ['ChatGPT-User', 'chatgpt-user', 'OAI-SearchBot', 'PerplexityBot', 'YouBot'];

interface BotRow {
  name: string;
  crawls: number;
  isHuman: boolean;
}

interface CrawlStats {
  total: number;
  human: number;
  bot: number;
  rows: BotRow[];
}

type PageState = 'loading' | 'valid' | 'expired' | 'invalid';

export default function SandboxStep1() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const basePath = useBasePath();
  const { trackEvent } = useGA4Tracking();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [professional, setProfessional] = useState<any>(null);
  const [crawlStats, setCrawlStats] = useState<CrawlStats | null>(null);
  const [showBotBreakdown, setShowBotBreakdown] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    if (!token) { setPageState('invalid'); return; }
    validateToken(token).then(async (result) => {
      if (result.status === 'valid') {
        const p = result.professional;
        // Redirect paid/certified agents to their dashboard — they shouldn't re-enter the funnel
        const agentTier = (p.current_tier || p.badge_tier || 'listed').toLowerCase();
        if (['certified', 'audited', 'underwritten'].includes(agentTier)) {
          navigate(`/dashboard/${p.verification_token || p.id}`, { replace: true });
          return;
        }
        setProfessional(p);
        setPageState('valid');

        // Snapshot original state for dev revert on success page
        if (!sessionStorage.getItem(`sandbox_snapshot_${token}`)) {
          sessionStorage.setItem(`sandbox_snapshot_${token}`, JSON.stringify({
            email: p.email,
            phone: p.phone,
            phone_numbers: p.phone_numbers,
            website: p.website,
            current_tier: p.current_tier,
            badge_tier: p.badge_tier,
          }));
        }

        trackEvent('sandbox_step1_view', {
          professional_id: result.professional.id,
          professional_name: result.professional.name,
        });
        // Fetch 7-day AI surfaces breakdown
        try {
          const { data: rows } = await supabase.rpc('run_sql' as any, {
            query: `SELECT bot_name, crawls FROM agent_ai_surfaces_by_bot WHERE agent_id = '${result.professional.id}' ORDER BY crawls DESC`,
          });
          if (rows && Array.isArray(rows)) {
            const total = rows.reduce((s: number, r: any) => s + r.crawls, 0);
            const human = rows.filter((r: any) => HUMAN_BOTS.includes(r.bot_name)).reduce((s: number, r: any) => s + r.crawls, 0);
            const botRows: BotRow[] = rows.map((r: any) => ({
              name: r.bot_name,
              crawls: r.crawls,
              isHuman: HUMAN_BOTS.includes(r.bot_name),
            }));
            setCrawlStats({ total, human, bot: total - human, rows: botRows });
          }
        } catch { /* surfaces not available */ }
      } else {
        setPageState(result.status);
      }
    });
  }, [token]);

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <SafeHead><title>Loading | Top10Lists.us</title><meta name="robots" content="noindex, nofollow" /></SafeHead>
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your listing...</p>
        </div>
      </div>
    );
  }

  if (pageState === 'expired') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <SafeHead><title>Link Expired | Top10Lists.us</title><meta name="robots" content="noindex, nofollow" /></SafeHead>
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Link Expired</h2>
            <p className="text-muted-foreground mb-6">This verification link has expired. Please request a new one or use the profile lookup to access your listing.</p>
            <Button onClick={() => navigate('/check-profile')}>Look Up My Profile</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pageState === 'invalid' || !professional) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <SafeHead><title>Not Found | Top10Lists.us</title><meta name="robots" content="noindex, nofollow" /></SafeHead>
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Profile Not Found</h2>
            <p className="text-muted-foreground mb-6">We could not find a listing for this link. It may have been deactivated or the link is incorrect.</p>
            <Button onClick={() => navigate('/check-profile')}>Look Up My Profile</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const firstName = (professional.name || '').split(' ')[0] || 'Agent';
  const stateAbbr = professional.cities?.state;
  const cityName = professional.cities?.name || '';
  const rating = professional.review_stars_rating || 0;
  const reviews = professional.num_total_reviews || 0;
  const years = professional.years_experience || 0;
  const company = professional.company && professional.company !== 'Unknown' ? professional.company : '';
  const tier = (professional.current_tier || professional.badge_tier || 'listed').toLowerCase();
  const tierLabel: Record<string, string> = { underwritten: 'Underwritten', audited: 'Audited', certified: 'Certified', listed: 'Listed' };

  return (
    <div className="min-h-screen bg-background">
      <SafeHead>
        <title>Certify Your Listing | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
      </SafeHead>

      <div className="max-w-xl mx-auto px-4 py-10 sm:py-16">
        <SandboxNugget>
          <p className="mb-2">The National Association of Realtors found that leads from AI convert at roughly 30%, comparable to a referral from a friend.</p>
          <p className="mb-2">Certifying your data will make you much safer for AI recommendation. This will result in a material increase in the probability that you will be named and endorsed by AI.</p>
          <p>Certification is free. Takes about 5 minutes.</p>
        </SandboxNugget>

        {/* Compact agent card */}
        <Card className="mb-6 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                {(professional.name || '?')[0]}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-semibold truncate">{professional.name}</h2>
                {company && <p className="text-sm text-muted-foreground">{company}</p>}
                {cityName && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3.5 w-3.5" /> {cityName}, {stateAbbr}
                  </p>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mt-6 text-center">
              <div className="bg-muted/50 rounded-lg py-3 px-2">
                <div className="flex items-center justify-center gap-1 text-lg font-bold">
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  {rating.toFixed(1)}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{reviews}+ reviews</p>
              </div>
              <div className="bg-muted/50 rounded-lg py-3 px-2">
                <div className="text-lg font-bold">{years}+</div>
                <p className="text-xs text-muted-foreground mt-0.5">years experience</p>
              </div>
              <div className="bg-muted/50 rounded-lg py-3 px-2">
                <div className="flex items-center justify-center gap-1 text-lg font-bold">
                  <Shield className="h-4 w-4 text-primary" />
                  {tierLabel[tier] || 'Listed'}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">verified tier</p>
              </div>
            </div>

            <p className="text-xs text-center text-muted-foreground mt-4">
              <strong>Your listing is already visible to these systems due to your presence on our list.</strong>
            </p>

            {/* 7-day crawl stats */}
            {crawlStats && crawlStats.total > 0 && (
              <>
                <div className="grid grid-cols-3 gap-3 mt-3 text-center">
                  <div className="bg-primary/5 border border-primary/20 rounded-lg py-3 px-2">
                    <div className="flex items-center justify-center gap-1 text-lg font-bold text-primary">
                      <Eye className="h-4 w-4" />
                      {crawlStats.total.toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">7-day total</p>
                  </div>
                  <div className="bg-primary/5 border border-primary/20 rounded-lg py-3 px-2">
                    <div className="text-lg font-bold text-primary">{crawlStats.human.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground mt-0.5">Human-initiated</p>
                  </div>
                  <div className="bg-primary/5 border border-primary/20 rounded-lg py-3 px-2">
                    <div className="text-lg font-bold text-primary">{crawlStats.bot.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground mt-0.5">Bot Training</p>
                  </div>
                </div>
                {crawlStats.human > 0 && (
                  <p className="text-xs text-center text-primary/80 mt-3">
                    {crawlStats.human.toLocaleString()} of these were from real consumer queries on ChatGPT, Perplexity, or You.com
                  </p>
                )}

                {/* Bot breakdown expander */}
                <div className="text-center mt-2">
                  <button
                    onClick={() => setShowBotBreakdown(!showBotBreakdown)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
                  >
                    {showBotBreakdown ? 'Hide details' : 'See which systems crawled you'}
                  </button>
                  {showBotBreakdown && crawlStats.rows.length > 0 && (() => {
                    const top5 = crawlStats.rows.slice(0, 5);
                    const rest = crawlStats.rows.slice(5);
                    const otherTotal = rest.reduce((s, r) => s + r.crawls, 0);
                    return (
                      <div className="mt-2 text-xs space-y-1">
                        {top5.map((r) => (
                          <div key={r.name} className="flex justify-between px-4">
                            <span className={r.isHuman ? 'text-primary' : 'text-muted-foreground'}>
                              {r.name} {r.isHuman ? '(human)' : ''}
                            </span>
                            <span className="font-medium">{r.crawls.toLocaleString()}</span>
                          </div>
                        ))}
                        {otherTotal > 0 && (
                          <div className="flex justify-between px-4">
                            <span className="text-muted-foreground">Other ({rest.length} bots)</span>
                            <span className="font-medium">{otherTotal.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </>
            )}

          </CardContent>
        </Card>

        {/* CTA */}
        <div className="flex justify-center">
          <Button
            size="lg"
            className="w-full sm:w-auto sm:min-w-[280px] bg-primary hover:bg-primary/90 text-lg py-6"
            onClick={() => {
              trackEvent('sandbox_step1_claim_click', { professional_id: professional.id });
              navigate(`${basePath}/${token}/contact`);
            }}
          >
            Certify Your Listing
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Free. Takes about 5 minutes.
        </p>
      </div>
    </div>
  );
}
