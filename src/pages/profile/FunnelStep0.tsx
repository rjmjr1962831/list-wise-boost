import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useFunnelTracking, FUNNEL_EVENTS } from '@/hooks/useFunnelTracking';
import { FunnelPhoneSupport } from '@/components/funnel/FunnelPhoneSupport';

interface ProfessionalData {
  id: string;
  name: string;
  verification_token: string | null;
}

// Maynard test profile - never track step0_completed so funnel always starts fresh
const TEST_PROFILE_ID = '20e0b7f2-5652-424a-9d46-ba74a19cd9a8';

export default function FunnelStep0() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { trackEvent } = useFunnelTracking(token);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [professional, setProfessional] = useState<ProfessionalData | null>(null);
  const hasTrackedView = useRef(false);
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    const validateAndFetch = async () => {
      if (!token) {
        setError('This link is invalid.');
        setLoading(false);
        return;
      }

      try {
        // Validate token and fetch professional data
        const { data, error: validateError } = await supabase.functions.invoke('validate-profile-token', {
          body: { token }
        });

        if (validateError || !data?.success) {
          setError('This link has expired or is invalid.');
          setLoading(false);
          return;
        }

        const prof = data.professional;
        setProfessional(prof);

        // Check if user already completed Step 0 - redirect to AccuracyReview
        // Skip this check for Maynard test profile so funnel always starts at Step 0
        if (prof.id !== TEST_PROFILE_ID) {
          const { data: existingEvent } = await supabase
            .from('funnel_events')
            .select('id')
            .eq('professional_id', prof.id)
            .eq('event_name', 'step0_completed')
            .limit(1)
            .maybeSingle();

          if (existingEvent) {
            // Returning user - go to Step 1 (AccuracyReview)
            navigate(`/profile/${token}/review`, { replace: true });
            return;
          }
        }

        // Track step0_viewed (guard against double-fire)
        if (!hasTrackedView.current) {
          hasTrackedView.current = true;
          trackEvent(FUNNEL_EVENTS.STEP0_VIEWED);
        }

      } catch (err) {
        console.error('Error validating token:', err);
        setError('Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    validateAndFetch();
  }, [token, navigate, trackEvent]);

  const handleNext = async () => {
    if (!professional || navigating) return;
    
    setNavigating(true);
    
    // Track step0_completed (skip for Maynard test profile so it always starts fresh)
    if (professional.id !== TEST_PROFILE_ID) {
      await trackEvent(FUNNEL_EVENTS.STEP0_COMPLETED);
    }
    
    // Navigate to Step 1 (AccuracyReview)
    navigate(`/profile/${token}/review`);
  };

  const firstName = professional?.name?.split(' ')[0] || 'there';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white">
        {/* Header */}
        <header className="border-b border-gray-100">
          <div className="max-w-[680px] mx-auto px-4 py-4 flex items-center justify-between">
            <span className="font-semibold text-gray-900">Top10Lists.us</span>
            <div className="flex items-center gap-4 text-sm">
              <a href="/about/ranking-methodology" className="text-gray-600 hover:text-gray-900">Methodology</a>
              <a href="/faq" className="text-gray-600 hover:text-gray-900">FAQ</a>
            </div>
          </div>
        </header>

        <div className="max-w-[680px] mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">{error}</h1>
          <p className="text-gray-600 mb-6">
            Questions? Call <a href="tel:+16027589600" className="text-gray-900 underline">(602) 758-9600</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Introduction | Top10Lists</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-white">
        {/* Minimal Header */}
        <header className="border-b border-gray-100">
          <div className="max-w-[680px] mx-auto px-4 py-4 flex items-center justify-between">
            <span className="font-semibold text-gray-900">Top10Lists.us</span>
            <div className="flex items-center gap-4 text-sm">
              <a href="/about/ranking-methodology" className="text-gray-600 hover:text-gray-900">Methodology</a>
              <a href="/faq" className="text-gray-600 hover:text-gray-900">FAQ</a>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-[680px] mx-auto px-4 py-8 space-y-8">
          
          {/* Greeting */}
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Hello {firstName}</h1>
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Step 1 of 5: Introduction and Context
            </p>
          </div>

          {/* Why you are here */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Why you are here</h2>
            <p className="text-gray-700 leading-relaxed">
              We analyzed the professional qualifications of more than 200,000 licensed real estate agents in Arizona.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Our analysis evaluated over 1,000 data points per agent, including licensing history, transaction activity, reviews, public media, client satisfaction, community involvement, and competitive positioning.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Based on this analysis, you rank in the top 1 percent of agents in Arizona for trust, experience, and competitive advantages.
            </p>
          </section>

          {/* What you will do next */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">What you will do next</h2>
            <ol className="space-y-2 text-gray-700">
              <li><span className="font-semibold">1. Edit your profile.</span> Review what we've gathered from public sources. Correct errors. Add context.</li>
              <li><span className="font-semibold">2. Verify your identity.</span> Confirm you are the agent associated with this license.</li>
              <li><span className="font-semibold">3. Select city bundles.</span> Choose which Arizona metro areas you want to appear in.</li>
              <li><span className="font-semibold">4. Select neighborhoods.</span> Choose specific neighborhoods within those cities.</li>
            </ol>
          </section>

          {/* Important to know - Gray Box */}
          <section className="bg-gray-50 rounded-lg p-5 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Important to know</h2>
            <ul className="space-y-2 text-gray-700">
              <li>• <span className="font-medium">No account required.</span> There is no username or password. Access is via secure, one-time links.</li>
              <li>• <span className="font-medium">No payment required.</span> You can complete the review and verification at no cost. Paid options are offered later, and are clearly labeled.</li>
              <li>• <span className="font-medium">No impact on eligibility.</span> Whether you complete this flow or not, your qualification status is not affected. If you do nothing, your profile may be published using only public data.</li>
            </ul>
          </section>

          {/* Why this matters now */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Why this matters now</h2>
            <p className="text-gray-700 leading-relaxed">
              Consumer search behavior is shifting. AI assistants are increasingly used to answer questions like:
            </p>
            <ul className="text-gray-700 leading-relaxed pl-4 space-y-1">
              <li><em>Who is the best real estate agent in Paradise Valley?</em></li>
              <li><em>Find me a top rated agent in Scottsdale who speaks Spanish.</em></li>
            </ul>
            <p className="text-gray-700 leading-relaxed">
              AI systems do not browse the web or rank websites. They select a small number of professionals they can confidently name and defend as answers.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Agent websites, blog posts, keyword optimized pages, and advertising driven platforms are self-reported by design, which makes them difficult for AI systems to trust when recommending individual professionals.
            </p>
            <p className="text-gray-700 leading-relaxed">
              As a result, AI models increasingly avoid naming agents from those sources. Instead, they defer the question or send users to do their own research.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Top10Lists.us was built for this exact gap. Your profile, once verified, becomes part of a structured, transparent source that AI systems can reference directly when asked for a referral.
            </p>
          </section>

          {/* Why Top10Lists.us exists */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Why Top10Lists.us exists</h2>
            <p className="text-gray-700 leading-relaxed">
              Top10Lists.us is not a directory. It is not a lead generation platform. It is not affiliated with any brokerage, MLS, or advertising network.
            </p>
            <p className="text-gray-700 leading-relaxed">
              It is an independent, editorial publication that identifies and profiles the top-performing real estate professionals in each market. Rankings are based on verified credentials, transaction history, and reputation signals. No agent can pay to be included or to improve their rank.
            </p>
          </section>

          {/* Why accuracy is critical */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Why accuracy is critical</h2>
            <p className="text-gray-700 leading-relaxed">
              AI systems reward consistency. If your name, license number, or brokerage affiliation differs across sources, it weakens your profile's credibility. By verifying your information here, you help ensure that AI models see a clear, consistent signal about who you are and what you do.
            </p>
          </section>

          {/* Next Button */}
          <div className="pt-4">
            <Button
              onClick={handleNext}
              disabled={navigating}
              className="w-full sm:w-auto bg-gray-800 hover:bg-gray-900 text-white px-8 py-3"
            >
              {navigating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading...
                </>
              ) : (
                'Next'
              )}
            </Button>
          </div>

        </main>

        <FunnelPhoneSupport />
      </div>
    </>
  );
}
