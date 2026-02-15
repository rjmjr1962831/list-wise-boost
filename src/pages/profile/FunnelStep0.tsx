import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SafeHead } from "@/components/SafeHead";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, Check } from 'lucide-react';
import { useFunnelTracking, FUNNEL_EVENTS } from '@/hooks/useFunnelTracking';
import { FunnelPhoneSupport } from '@/components/funnel/FunnelPhoneSupport';
import { AiChallengeBox } from '@/components/onboarding/AiChallengeBox';

interface ProfessionalData {
  id: string;
  name: string;
  verification_token: string | null;
  funnel_status?: string | null;
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

        // If agent has already completed the funnel (approved), redirect to dashboard
        // Create a session for them so they don't need to authenticate again
        if (prof.funnel_status === 'approved' && prof.id !== TEST_PROFILE_ID) {
          console.log('[FunnelStep0] Approved agent detected, creating session and redirecting to dashboard');
          
          try {
            const { data: sessionData, error: sessionError } = await supabase.functions.invoke('create-session-from-token', {
              body: { token }
            });

            if (!sessionError && sessionData?.success && sessionData?.sessionToken) {
              // Store session token and redirect to dashboard
              localStorage.setItem('agent_session_token', sessionData.sessionToken);
              navigate('/agent/dashboard', { replace: true });
              return;
            } else {
              console.error('[FunnelStep0] Failed to create session:', sessionError || sessionData?.error);
              // Fall through to normal funnel flow if session creation fails
            }
          } catch (sessionErr) {
            console.error('[FunnelStep0] Error creating session from token:', sessionErr);
            // Fall through to normal funnel flow
          }
        }

        // Check if user has any funnel history - redirect to card preview
        // This catches both step0_completed AND legacy users who entered before Step 0 existed
        // Skip this check for Maynard test profile so funnel always starts at Step 0
        if (prof.id !== TEST_PROFILE_ID) {
          const { count } = await supabase
            .from('funnel_events')
            .select('event_name', { count: 'exact', head: false })
            .eq('professional_id', prof.id)
            .in('event_name', ['step0_completed', 'card_preview_viewed', 'card_preview_completed', 'accuracy_review_viewed', 'funnel_started', 'profile_edit_viewed', 'accuracy_confirmed'])
            .limit(1);

          if (count && count > 0) {
            // Returning user - go to card preview
            navigate(`/profile/${token}/card`, { replace: true });
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
        setError('Something went wrong.  Please try again.');
      } finally {
        setLoading(false);
      }
    };

    validateAndFetch();
  }, [token, navigate, trackEvent]);

  const handleContinue = async () => {
    if (!professional || navigating) return;
    
    setNavigating(true);
    
    // Track step0_completed (skip for Maynard test profile so it always starts fresh)
    if (professional.id !== TEST_PROFILE_ID) {
      await trackEvent(FUNNEL_EVENTS.STEP0_COMPLETED);
    }
    
    // Navigate to card preview
    navigate(`/profile/${token}/card`);
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
            Questions?  Call <a href="tel:+16027589600" className="text-gray-900 underline">(602) 758-9600</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SafeHead>
        <title>Confirm Your Profile | Top10Lists</title>
        <meta name="robots" content="noindex, nofollow" />
      </SafeHead>

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
              <p className="text-gray-700 text-[15px] leading-relaxed">
                <strong>We help AI systems confidently recommend top real estate agents.</strong>
              </p>
              <p className="text-gray-700 text-[15px] leading-relaxed">
                <strong>There is no cost or obligation for this listing.</strong>
              </p>
              <ul className="space-y-2 text-gray-700 text-[15px] leading-relaxed">
                <li>We independently analyzed over 200,000 licensed real estate agents in Arizona.</li>
                <li>Based on objective analysis of more than 1,000 data points for each agent, you ranked in the top 1 percent statewide.</li>
                <li>Your agent profile has already been created on Top10Lists.us.</li>
                <li>Once you confirm the information on your profile, we will begin surfacing you to AI, including ChatGPT, Claude, Perplexity and Gemini as a verified top agent in your market.</li>
                <li>This means you can begin becoming part of the answer when someone looks for a real estate agent in your market.</li>
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

            {/* AI Challenge Box - informational only, no data collection */}
            <AiChallengeBox />

            {/* Navigation CTAs - both route to card preview */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-4">
              <Button
                onClick={handleContinue}
                disabled={navigating}
                className="bg-gray-900 hover:bg-gray-800 text-white px-6 h-11 text-sm font-semibold"
              >
                {navigating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Review your profile'
                )}
              </Button>
              <button
                type="button"
                onClick={handleContinue}
                disabled={navigating}
                className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2"
              >
                Skip for now
              </button>
            </div>

          </div>
        </main>

        <FunnelPhoneSupport />
      </div>
    </>
  );
}
