/**
 * NeighborhoodApply - Entry point for agents clicking "Think you belong here?"
 * 
 * Routes agents based on their session status:
 * - Has valid session token → redirect to neighborhood selection with preselect
 * - No token → show email form, then route based on professional status
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { SafeHead } from "@/components/SafeHead";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, ArrowRight, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function NeighborhoodApply() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // URL params for neighborhood context
  const state = searchParams.get('state') || '';
  const city = searchParams.get('city') || '';
  const zip = searchParams.get('zip') || '';
  const neighborhood = searchParams.get('neighborhood') || '';
  
  const [loading, setLoading] = useState(true);
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Format neighborhood name for display
  const neighborhoodDisplay = neighborhood
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  
  const cityDisplay = city
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  // Check for existing session on mount
  useEffect(() => {
    const checkExistingSession = async () => {
      const sessionToken = localStorage.getItem('agent_session_token');
      
      if (!sessionToken) {
        setCheckingSession(false);
        setLoading(false);
        return;
      }

      try {
        // Validate the session token
        const { data, error } = await supabase.functions.invoke('validate-agent-session', {
          body: { sessionToken }
        });

        if (error || !data?.valid) {
          // Invalid session - clear and show form
          localStorage.removeItem('agent_session_token');
          setCheckingSession(false);
          setLoading(false);
          return;
        }

        // Valid session - get verification token and redirect
        const { data: professional } = await supabase
          .from('professionals')
          .select('verification_token')
          .eq('id', data.professionalId)
          .single();

        if (professional?.verification_token) {
          // Redirect to neighborhood selection with preselect (include city for disambiguation)
          const redirectUrl = `/profile/${professional.verification_token}/select-neighborhoods?preselect=${neighborhood}&city=${city}`;
          navigate(redirectUrl, { replace: true });
          return;
        }
        
        setCheckingSession(false);
        setLoading(false);
      } catch (err) {
        console.error('[NeighborhoodApply] Session check error:', err);
        localStorage.removeItem('agent_session_token');
        setCheckingSession(false);
        setLoading(false);
      }
    };

    checkExistingSession();
  }, [navigate, neighborhood]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }

    setSubmitting(true);

    try {
      // Call edge function to check agent status
      const { data, error } = await supabase.functions.invoke('check-agent-by-email', {
        body: { email: email.trim() }
      });

      if (error) {
        console.error('[NeighborhoodApply] Email check error:', error);
        toast.error('Something went wrong. Please try again.');
        setSubmitting(false);
        return;
      }

      if (!data.exists || !data.active) {
        // Not on the list or inactive - redirect to qualification page
        toast.info('Let\'s check if you qualify for our directory.');
        navigate('/are-you-an-agent', { 
          state: { 
            message: 'Complete your profile to become eligible for neighborhood expert positions.',
            fromNeighborhood: neighborhood 
          }
        });
        return;
      }

      // Found and active - route based on funnel status
      const verificationToken = data.verification_token;
      
      if (!verificationToken) {
        toast.error('Account issue detected. Please contact support.');
        setSubmitting(false);
        return;
      }

      if (!data.hasStartedFunnel) {
        // Never started funnel - go to Step 0
        navigate(`/profile/${verificationToken}`, {
          state: { fromNeighborhood: neighborhood }
        });
      } else {
        // Has started funnel - go to neighborhood selection (include city for disambiguation)
        navigate(`/profile/${verificationToken}/select-neighborhoods?preselect=${neighborhood}&city=${city}`);
      }
    } catch (err) {
      console.error('[NeighborhoodApply] Submit error:', err);
      toast.error('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading || checkingSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Checking your session...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SafeHead>
        <title>Apply for Neighborhood Expert | Top10Lists</title>
        <meta name="description" content={`Apply to become a Neighborhood Expert for ${neighborhoodDisplay}, ${cityDisplay}`} />
        <meta name="robots" content="noindex, nofollow" />
      </SafeHead>

      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-12 px-4">
        <div className="max-w-md mx-auto">
          {/* Neighborhood Context Card */}
          {neighborhood && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Applying for</p>
                  <p className="font-semibold text-foreground">
                    {neighborhoodDisplay}, {cityDisplay}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Main Card */}
          <div className="bg-card border border-border rounded-2xl shadow-lg p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Become a Neighborhood Expert
              </h1>
              <p className="text-muted-foreground">
                Enter your email to check your eligibility and apply for this featured position.
              </p>
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                  Email Address
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  className="w-full"
                  autoFocus
                />
              </div>

              <Button
                type="submit"
                disabled={submitting || !email.trim()}
                className="w-full"
                size="lg"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Checking...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">
                Only agents who meet our{' '}
                <a href="/about/ranking-methodology" className="text-primary hover:underline">
                  editorial criteria
                </a>{' '}
                can become Neighborhood Experts. Selection cannot be purchased.
              </p>
            </div>
          </div>

          {/* Benefits */}
          <div className="mt-8 space-y-3">
            <h3 className="text-sm font-semibold text-foreground text-center">
              Neighborhood Expert Benefits
            </h3>
            <div className="grid gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span>Featured position at the top of neighborhood pages</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span>Enhanced profile visibility in AI search results</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span>Verified neighborhood expertise badge</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
