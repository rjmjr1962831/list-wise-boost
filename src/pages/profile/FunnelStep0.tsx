import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, Check } from 'lucide-react';
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

        // Check if user has any funnel history - redirect to AccuracyReview
        // This catches both step0_completed AND legacy users who entered before Step 0 existed
        // Skip this check for Maynard test profile so funnel always starts at Step 0
        if (prof.id !== TEST_PROFILE_ID) {
          const { data: existingEvents, count } = await supabase
            .from('funnel_events')
            .select('event_name', { count: 'exact', head: false })
            .eq('professional_id', prof.id)
            .in('event_name', ['step0_completed', 'accuracy_review_viewed', 'funnel_started', 'profile_edit_viewed', 'accuracy_confirmed'])
            .limit(1);

          if (count && count > 0) {
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
          <div className="max-w-[720px] mx-auto px-4 py-4 flex items-center justify-between">
            <span className="font-semibold text-gray-900">Top10Lists.us</span>
            <div className="flex items-center gap-4 text-sm">
              <a href="/about/ranking-methodology" className="text-gray-600 hover:text-gray-900">Methodology</a>
              <a href="/faq" className="text-gray-600 hover:text-gray-900">FAQ</a>
            </div>
          </div>
        </header>

        <div className="max-w-[720px] mx-auto px-4 py-16 text-center">
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
        <title>Confirm Your Profile | Top10Lists</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-gray-50 pb-24 sm:pb-8">
        {/* Minimal Header */}
        <header className="border-b border-gray-100 bg-white">
          <div className="max-w-[720px] mx-auto px-4 py-4 flex items-center justify-between">
            <span className="font-semibold text-gray-900">Top10Lists.us</span>
            <div className="flex items-center gap-4 text-sm">
              <a href="/about/ranking-methodology" className="text-gray-600 hover:text-gray-900">Methodology</a>
              <a href="/faq" className="text-gray-600 hover:text-gray-900">FAQ</a>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-[720px] mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 space-y-6">
            
            {/* Step Label */}
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Step 1 of 5
            </p>

            {/* Title and Time Estimate */}
            <div className="space-y-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Hello {firstName}
              </h1>
              <span className="inline-block text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                Estimated time: 3 to 5 minutes
              </span>
            </div>

            {/* Why you are here */}
            <section className="space-y-2 pt-2">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Why you are here</h2>
              <ul className="space-y-2 text-gray-700 text-[15px] leading-relaxed">
                <li>We independently analyzed over 200,000 licensed real estate agents in Arizona.</li>
                <li>Based on objective data, you ranked in the top 1 percent statewide.</li>
                <li>Your agent profile has already been created on Top10Lists.us.</li>
              </ul>
            </section>

            {/* What happens next */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">What happens next</h2>
              <ul className="space-y-2">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-900 flex items-center justify-center mt-0.5">
                    <Check className="w-3 h-3 text-white" />
                  </span>
                  <span className="text-gray-700 text-[15px]">Review your existing profile</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-900 flex items-center justify-center mt-0.5">
                    <Check className="w-3 h-3 text-white" />
                  </span>
                  <span className="text-gray-700 text-[15px]">Correct or clarify any information</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-900 flex items-center justify-center mt-0.5">
                    <Check className="w-3 h-3 text-white" />
                  </span>
                  <span className="text-gray-700 text-[15px]">Choose the cities and neighborhoods you want to appear in</span>
                </li>
              </ul>
            </section>

            {/* Important to know */}
            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Important to know</h2>
              <ul className="space-y-2 text-gray-700 text-[15px] leading-relaxed">
                <li><span className="font-medium">No account required.</span></li>
                <li><span className="font-medium">No payment required.</span></li>
                <li>If you take no action, your profile may still be published using publicly available data.</li>
              </ul>
            </section>

            {/* Why this matters */}
            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Why this matters</h2>
              <ul className="space-y-2 text-gray-700 text-[15px] leading-relaxed">
                <li>Consumers are increasingly asking AI tools to name specific agents.</li>
                <li>Top10Lists.us exists so those systems can confidently recommend verified professionals and send clients directly to them.</li>
                <li><span className="font-medium">You are already included.</span></li>
                <li>Verification improves accuracy and visibility.</li>
              </ul>
            </section>

            {/* CTA Button - Desktop */}
            <div className="pt-4 hidden sm:block">
              <Button
                onClick={handleNext}
                disabled={navigating}
                aria-label="Review Your Profile"
                className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-3 h-12 text-base font-semibold"
              >
                {navigating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading...
                  </>
                ) : (
                  'Review Your Profile'
                )}
              </Button>
            </div>

          </div>
        </main>

        <FunnelPhoneSupport />

        {/* Sticky Mobile CTA */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 sm:hidden">
          <Button
            onClick={handleNext}
            disabled={navigating}
            aria-label="Review Your Profile"
            className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3 h-12 text-base font-semibold"
          >
            {navigating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading...
              </>
            ) : (
              'Review Your Profile'
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
