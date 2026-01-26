import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowRight } from 'lucide-react';
import { ProfessionalCard } from '@/components/ProfessionalCard';
import { FunnelPhoneSupport } from '@/components/funnel/FunnelPhoneSupport';
import { useFunnelTracking, FUNNEL_EVENTS } from '@/hooks/useFunnelTracking';

export default function ProfileCardPreview() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { trackEvent } = useFunnelTracking(token);
  
  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);
  const hasTrackedView = useRef(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const loadProfessional = async () => {
      if (!token) {
        setError('Invalid link');
        setLoading(false);
        return;
      }

      try {
        let data = null;

        // Try by ID first with full data needed for ProfessionalCard
        const byId = await supabase
          .from('professionals')
          .select(`
            *,
            cities:city_id (id, name, state, state_slug, slug),
            categories:category_id (id, name, slug)
          `)
          .eq('id', token)
          .maybeSingle();

        data = byId.data;

        // Fallback: try by verification_token
        if (!data) {
          const byToken = await supabase
            .from('professionals')
            .select(`
              *,
              cities:city_id (id, name, state, state_slug, slug),
              categories:category_id (id, name, slug)
            `)
            .eq('verification_token', token)
            .maybeSingle();

          data = byToken.data;
        }

        if (!data) {
          setError('Profile not found');
          return;
        }

        setProfessional(data);
        
        // Track view event
        if (!hasTrackedView.current) {
          hasTrackedView.current = true;
          trackEvent('card_preview_viewed');
        }
      } catch (err) {
        console.error('ProfileCardPreview loadProfessional error:', err);
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfessional();
  }, [token, trackEvent]);

  const handleContinue = async () => {
    if (!professional || navigating) return;
    
    setNavigating(true);
    await trackEvent('card_preview_completed');
    
    // Navigate to accuracy review (next step)
    navigate(`/profile/${token}/review`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
      </div>
    );
  }

  if (error || !professional) {
    return (
      <div className="min-h-screen bg-white">
        <header className="border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <span className="font-semibold text-gray-900">Top10Lists.us</span>
            <div className="flex items-center gap-4 text-sm">
              <a href="/about/ranking-methodology" className="text-gray-600 hover:text-gray-900">Methodology</a>
              <a href="/faq" className="text-gray-600 hover:text-gray-900">FAQ</a>
            </div>
          </div>
        </header>
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">{error || 'Profile not found'}</h1>
          <p className="text-gray-600">
            Questions? Call <a href="tel:+16027589600" className="text-gray-900 underline">(602) 758-9600</a>
          </p>
        </div>
      </div>
    );
  }

  const firstName = professional.name?.split(' ')[0] || 'there';

  return (
    <>
      <Helmet>
        <title>Your Current Profile | Top10Lists</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-gray-50 pb-24 sm:pb-8">
        {/* Header */}
        <header className="border-b border-gray-100 bg-white">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <span className="font-semibold text-gray-900">Top10Lists.us</span>
            <div className="flex items-center gap-4 text-sm">
              <a href="/about/ranking-methodology" className="text-gray-600 hover:text-gray-900">Methodology</a>
              <a href="/faq" className="text-gray-600 hover:text-gray-900">FAQ</a>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="space-y-6">
            
            {/* Step Label and Header */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                Step 2 of 5
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
                {firstName}, here is your current profile
              </h1>
              <p className="text-gray-600 text-[15px] leading-relaxed">
                This is how your profile appears to consumers and AI systems right now. 
                On the next screen, you'll be able to review the data and request any corrections.
              </p>
            </div>

            {/* Professional Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <ProfessionalCard 
                professional={professional} 
                accentColor="primary" 
                quizCompleted={true}
                expandSections={true}
              />
            </div>

            {/* CTA - Desktop */}
            <div className="hidden sm:flex justify-end">
              <Button
                onClick={handleContinue}
                disabled={navigating}
                className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-3 h-12 text-base font-semibold"
              >
                {navigating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading...
                  </>
                ) : (
                  <>
                    Continue to Review
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>

          </div>
        </main>

        <FunnelPhoneSupport />

        {/* Sticky Mobile CTA */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 sm:hidden">
          <Button
            onClick={handleContinue}
            disabled={navigating}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3 h-12 text-base font-semibold"
          >
            {navigating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading...
              </>
            ) : (
              <>
                Continue to Review
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
