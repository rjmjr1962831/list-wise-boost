import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Home, Phone } from 'lucide-react';

export default function StepSuccess() {
  const { token } = useParams<{ token: string }>();

  useEffect(() => {
    // Confetti or celebration animation could go here
  }, []);

  return (
    <>
      <Helmet>
        <title>Welcome to Top10Lists! | Top10Lists.us</title>
      </Helmet>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-6">
                <div className="rounded-full bg-green-100 dark:bg-green-900 p-6">
                  <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <CardTitle className="text-3xl">You're All Set!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-center">
              <p className="text-lg text-muted-foreground">
                Congratulations! Your profile is now being processed.
              </p>

              <div className="border rounded-lg p-6 bg-muted/50">
                <h3 className="font-semibold text-lg mb-3">What happens next?</h3>
                <ul className="text-left space-y-2 text-sm">
                  <li className="flex gap-2">
                    <span className="text-primary font-bold">1.</span>
                    <span>Our team will review your profile within 24 hours</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary font-bold">2.</span>
                    <span>You'll receive an email with your login credentials</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary font-bold">3.</span>
                    <span>Your profile will go live and start appearing in search results</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary font-bold">4.</span>
                    <span>We'll send you weekly reports on your visibility and leads</span>
                  </li>
                </ul>
              </div>

              <div className="border-t pt-6 space-y-4">
                <p className="text-sm text-muted-foreground">
                  In the meantime, feel free to explore our site or contact us with any questions.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button asChild variant="outline" className="gap-2">
                    <a href="/">
                      <Home className="h-4 w-4" />
                      Go to Homepage
                    </a>
                  </Button>
                  <Button asChild className="gap-2">
                    <a href="tel:6027589600">
                      <Phone className="h-4 w-4" />
                      Call Us: (602) 758-9600
                    </a>
                  </Button>
                </div>
              </div>

              <div className="border-t pt-6">
                <p className="text-xs text-muted-foreground">
                  Check your email for a confirmation and next steps. If you don't see it within 24 hours, please check your spam folder or contact us.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
