import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, Check, Pencil } from 'lucide-react';
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
  const [navigating, setNavigating] = useState<'verify' | 'edit' | null>(null);
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

  const handleLooksGood = async () => {
    if (!professional || navigating) return;
    
    setNavigating('verify');
    
    try {
      // Record verification event
      await trackEvent('profile_verified');
      
      // Navigate to city/neighborhood selection
      navigate(`/profile/${token}/pricing`);
    } catch (err) {
      console.error('Error verifying profile:', err);
      setNavigating(null);
    }
  };

  const handleMakeChanges = async () => {
    if (!professional || navigating) return;
    
    setNavigating('edit');
    await trackEvent('edit_requested_from_card');
    
    // Navigate to profile edit page
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
                This is your live public profile
              </h1>
              <p className="text-gray-600 text-[15px] leading-relaxed mb-2">
                This is your live public profile as it currently appears on Top10Lists.us.
              </p>
              <p className="text-gray-500 text-sm">
                AI tools reference this information when answering recommendation questions.
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

            {/* Two CTAs - Desktop */}
            <div className="hidden sm:flex gap-6 justify-center">
              {/* Primary: Looks good */}
              <div className="flex flex-col items-center">
                <Button
                  onClick={handleLooksGood}
                  disabled={!!navigating}
                  className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-3 h-12 text-base font-semibold"
                >
                  {navigating === 'verify' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Looks good
                    </>
                  )}
                </Button>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  This confirms your profile as accurate.
                </p>
              </div>

              {/* Secondary: Make some changes */}
              <div className="flex flex-col items-center">
                <Button
                  onClick={handleMakeChanges}
                  disabled={!!navigating}
                  variant="outline"
                  className="border-gray-300 text-gray-700 hover:bg-gray-50 px-8 py-3 h-12 text-base font-semibold"
                >
                  {navigating === 'edit' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Pencil className="mr-2 h-4 w-4" />
                      Make some changes
                    </>
                  )}
                </Button>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Edit your profile before it's verified.
                </p>
              </div>
            </div>

          </div>
        </main>

        <FunnelPhoneSupport />

        {/* Sticky Mobile CTAs */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 sm:hidden space-y-3">
          <div>
            <Button
              onClick={handleLooksGood}
              disabled={!!navigating}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3 h-12 text-base font-semibold"
            >
              {navigating === 'verify' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Verifying...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Looks good
                </>
              )}
            </Button>
            <p className="text-xs text-gray-500 mt-1.5 text-center">
              This confirms your profile as accurate.
            </p>
          </div>
          
          <div>
            <Button
              onClick={handleMakeChanges}
              disabled={!!navigating}
              variant="outline"
              className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 py-3 h-12 text-base font-semibold"
            >
              {navigating === 'edit' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading...
                </>
              ) : (
                <>
                  <Pencil className="mr-2 h-4 w-4" />
                  Make some changes
                </>
              )}
            </Button>
            <p className="text-xs text-gray-500 mt-1.5 text-center">
              Edit your profile before it's verified.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
