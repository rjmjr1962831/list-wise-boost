import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Home, Mail, Loader2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function AgentPaymentSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const professionalId = searchParams.get('professional_id');
  
  const [isProcessing, setIsProcessing] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
          
          // Track successful payment
          if (typeof window.gtag === 'function') {
            window.gtag('event', 'purchase', {
              transaction_id: sessionId,
              currency: 'USD',
              items: [{
                item_name: 'Premium Placement Subscription',
                item_category: 'Subscription'
              }]
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
  }, [sessionId, professionalId]);

  if (isProcessing) {
    return (
      <>
        <Helmet>
          <title>Processing Payment... | Top10Lists</title>
        </Helmet>
        <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Processing Your Payment...</h1>
            <p className="text-muted-foreground">Please wait while we activate your subscription.</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Helmet>
          <title>Payment Issue | Top10Lists</title>
        </Helmet>
        <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30">
          <Header />
          <div className="container mx-auto px-4 py-12 max-w-3xl text-center">
            <div className="mb-8">
              <div className="rounded-full bg-red-100 p-6 inline-block">
                <Mail className="h-16 w-16 text-red-600" />
              </div>
            </div>
            <h1 className="text-3xl font-bold mb-4">There was an issue</h1>
            <p className="text-muted-foreground mb-6">
              Your payment was processed, but we encountered an issue activating your subscription.
              Please contact us at <a href="mailto:hello@top10lists.us" className="text-primary underline">hello@top10lists.us</a> with your session ID below.
            </p>
            {sessionId && (
              <p className="text-xs text-muted-foreground mb-6">
                Session ID: {sessionId}
              </p>
            )}
            <Button asChild>
              <Link to="/">Return to Homepage</Link>
            </Button>
          </div>
          <Footer />
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Welcome to Premium Placement! | Top10Lists</title>
        <meta name="description" content="Your premium placement subscription is now active" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30">
        <Header />
        
        <div className="container mx-auto px-4 py-12 max-w-3xl">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-green-100 p-6">
                <CheckCircle2 className="h-16 w-16 text-green-600" />
              </div>
            </div>
            <h1 className="text-4xl font-bold mb-2">You're a Brand Builder! 🎉</h1>
            <p className="text-muted-foreground text-lg">
              Your Premium Placement subscription is now active
            </p>
          </div>

          <Card className="mb-6 border-green-200 bg-green-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-800">
                <Search className="h-5 w-5" />
                See Your Listing Now
              </CardTitle>
              <CardDescription>Your profile is live and ready to be found</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold">1</span>
                  <span>Go to the <Link to="/" className="text-primary underline font-medium">Top10Lists homepage</Link></span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold">2</span>
                  <span>Search for your city in the search box</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold">3</span>
                  <span>See your profile featured in the Top 10 results!</span>
                </li>
              </ol>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>What's Next?</CardTitle>
              <CardDescription>Here's what to expect</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                  ✓
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Profile Now Live</h3>
                  <p className="text-sm text-muted-foreground">
                    Your profile is immediately visible in the Top 10 for your selected cities.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                  ✓
                </div>
                <div>
                  <h3 className="font-semibold mb-1">AI-Optimized</h3>
                  <p className="text-sm text-muted-foreground">
                    Your profile is optimized for AI search – when buyers ask ChatGPT, Claude, Perplexity, or any other AI for agent recommendations, you'll be featured.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                  ✓
                </div>
                <div>
                  <h3 className="font-semibold mb-1">24-Month Price Lock</h3>
                  <p className="text-sm text-muted-foreground">
                    Your early adopter pricing is locked in for 24 months – your rate will never increase.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/50 bg-gradient-to-br from-primary/5 to-accent/5 mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Check Your Email
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                We've sent a confirmation email with your subscription details and instructions.
                If you don't see it, please check your spam folder.
              </p>
            </CardContent>
          </Card>

          <div className="text-center">
            <Button asChild size="lg">
              <Link to="/">
                <Home className="h-5 w-5 mr-2" />
                Go to Homepage & Search Your City
              </Link>
            </Button>
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
}
