import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { CheckCircle, ArrowRight, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CoverageProgress } from '@/components/visibility/CoverageProgress';

const STORAGE_KEY = 'visibility_selection';

export default function VisibilitySuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isCleared, setIsCleared] = useState(false);

  const sessionId = searchParams.get('session_id');
  const professionalId = searchParams.get('professional_id');
  const type = searchParams.get('type'); // 'free' for free city coverage only

  const isFreeOnly = type === 'free';

  // Clear session storage on mount
  useEffect(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setIsCleared(true);
  }, []);

  const handleGoToDashboard = () => {
    if (professionalId) {
      navigate(`/agent/dashboard`);
    } else {
      navigate('/');
    }
  };

  return (
    <>
      <Helmet>
        <title>{isFreeOnly ? 'Coverage Confirmed' : 'Payment Successful'} | Top10Lists</title>
        <meta name="description" content={isFreeOnly ? "Your city coverage has been set up successfully." : "Your subscription has been activated successfully."} />
      </Helmet>

      <div className="container max-w-2xl mx-auto px-4 py-8">
        {/* Progress indicator - all steps complete */}
        <div className="mb-8">
          <CoverageProgress current="payment" />
        </div>

        {/* Success content */}
        <div className="text-center py-12">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>

          <h1 className="text-3xl font-bold mb-4">You're All Set!</h1>
          
          <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
            {isFreeOnly 
              ? "Your city coverage has been confirmed. You may be evaluated for rankings in your selected cities if you qualify."
              : "Your subscription has been activated. You'll now appear with enhanced visibility in your selected coverage areas."
            }
          </p>

          {/* Summary card */}
          <div className="bg-muted/50 rounded-lg p-6 mb-8 text-left max-w-md mx-auto">
            <h3 className="font-semibold mb-4">What happens next?</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-3">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>
                  {isFreeOnly 
                    ? "Your profile is now active in your selected cities"
                    : "Your profile is now live with neighborhood highlights"
                  }
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Rankings are merit-based and update throughout the day</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>
                  {isFreeOnly 
                    ? "You can add neighborhood highlights anytime from your dashboard"
                    : "You can manage your subscription anytime from your dashboard"
                  }
                </span>
              </li>
            </ul>
          </div>

          {/* Email confirmation note - only for paid */}
          {!isFreeOnly && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-8">
              <Mail className="w-4 h-4" />
              <span>A confirmation email has been sent to your inbox</span>
            </div>
          )}

          {/* CTA */}
          <Button size="lg" onClick={handleGoToDashboard}>
            Go to Dashboard
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>

          {/* Session ID for debugging (hidden in production) */}
          {sessionId && process.env.NODE_ENV === 'development' && (
            <p className="mt-8 text-xs text-muted-foreground">
              Session ID: {sessionId}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
