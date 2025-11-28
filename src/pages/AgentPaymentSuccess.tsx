import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Home, Mail } from 'lucide-react';

export default function AgentPaymentSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    // Track successful payment
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'purchase', {
        transaction_id: sessionId,
        value: 0, // You could calculate this from the session
        currency: 'USD',
        items: [{
          item_name: 'Agent Listing Subscription',
          item_category: 'Subscription'
        }]
      });
    }
  }, [sessionId]);

  return (
    <>
      <Helmet>
        <title>Payment Successful - Agent Onboarding | Top10Lists</title>
        <meta name="description" content="Your agent listing payment was successful" />
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
            <h1 className="text-4xl font-bold mb-2">Payment Successful!</h1>
            <p className="text-muted-foreground text-lg">
              Thank you for joining Top10Lists
            </p>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>What Happens Next?</CardTitle>
              <CardDescription>Here's what to expect</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                  1
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Application Review</h3>
                  <p className="text-sm text-muted-foreground">
                    Our team will review your application within 1-2 business days to ensure all information is accurate.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                  2
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Profile Activation</h3>
                  <p className="text-sm text-muted-foreground">
                    Once approved, your profile will be activated and live on the Top10Lists directory for your selected zip codes.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                  3
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Email Confirmation</h3>
                  <p className="text-sm text-muted-foreground">
                    You'll receive an email confirmation with details about your listing and next steps.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                  4
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Start Getting Leads</h3>
                  <p className="text-sm text-muted-foreground">
                    Your profile will be visible to potential clients searching for top agents in your area.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/50 bg-gradient-to-br from-primary/5 to-sunset-orange/5 mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Check Your Email
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                We've sent a confirmation email with your payment receipt and subscription details. 
                If you don't see it, please check your spam folder.
              </p>
            </CardContent>
          </Card>

          <div className="text-center">
            <Button asChild size="lg">
              <Link to="/">
                <Home className="h-5 w-5 mr-2" />
                Return to Homepage
              </Link>
            </Button>
          </div>

          {sessionId && (
            <p className="text-center text-xs text-muted-foreground mt-6">
              Payment Session ID: {sessionId}
            </p>
          )}
        </div>

        <Footer />
      </div>
    </>
  );
}
