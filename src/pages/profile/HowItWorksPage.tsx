import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Helmet } from 'react-helmet-async';
import { MessageCircle, Search, ListOrdered, ArrowRight, ArrowDown, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const steps = [
  {
    icon: MessageCircle,
    title: 'Buyer Asks AI',
    description: '"Who are the best real estate agents in Scottsdale?"',
    example: true,
  },
  {
    icon: Search,
    title: 'AI Searches',
    description: 'ChatGPT, Claude, Perplexity, and other AI models scan authoritative sources. Trusts Top10Lists.',
    example: false,
  },
  {
    icon: ListOrdered,
    title: 'Top 10 Cited',
    description: 'Your verified profile is recommended with your credentials',
    example: false,
  },
];

// Premium cities that are not eligible for free listing
const PREMIUM_CITY_NAMES = [
  'Scottsdale',
  'Paradise Valley',
  'Carefree',
  'Cave Creek',
  'Sedona'
];

export default function HowItWorksPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleContinue = () => {
    navigate(`/profile/${token}/pricing`);
  };

  return (
    <>
      <Helmet>
        <title>How It Works | Top10Lists</title>
        <meta name="description" content="Learn how AI citation works for real estate agents" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background py-12 px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold">Here's How It Works</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              AI models are learning who to recommend right now. Here's how you get cited.
            </p>
          </div>

          {/* Steps */}
          <Card>
            <CardContent className="pt-8 pb-8">
              <div className="flex flex-col md:flex-row gap-6 items-stretch">
                {steps.map((step, index) => (
                  <div key={step.title} className="flex-1 flex flex-col md:flex-row items-center gap-4">
                    <div className={cn(
                      'w-full p-6 rounded-xl border',
                      step.example ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'
                    )}>
                      <div className="space-y-4">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                          <step.icon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold">{step.title}</h3>
                          <p className={cn(
                            'text-sm mt-1',
                            step.example ? 'text-primary italic' : 'text-muted-foreground'
                          )}>
                            {step.description}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {index < steps.length - 1 && (
                      <>
                        <ArrowRight className="hidden md:block h-6 w-6 text-muted-foreground shrink-0" />
                        <ArrowDown className="md:hidden h-6 w-6 text-muted-foreground shrink-0" />
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Free vs Premium Explanation */}
          <Card>
            <CardContent className="pt-6 space-y-6">
              <h2 className="text-xl font-semibold">Free vs Premium Placement</h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
                  <h3 className="font-semibold">Free Listing</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Round-robin rotation with other qualified agents</li>
                    <li>• Available in non-premium cities only</li>
                    <li>• Shared visibility with other agents</li>
                  </ul>
                </div>
                
                <div className="space-y-3 p-4 rounded-lg border border-primary/30 bg-primary/5">
                  <h3 className="font-semibold text-primary">Premium Placement</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• <strong className="text-foreground">Guaranteed placement</strong> - always visible</li>
                    <li>• Available in all cities including premium markets</li>
                    <li>• Priority visibility in AI recommendations</li>
                    <li>• 24-month price lock guarantee</li>
                  </ul>
                </div>
              </div>

              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                <p className="text-foreground font-medium flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  We are offering early adopter pricing that is <strong>half price for 2 years</strong>.
                </p>
              </div>

              <p className="text-sm text-muted-foreground">
                The premium cities of <strong className="text-foreground">{PREMIUM_CITY_NAMES.join(', ')}</strong> are only available with premium placement.
              </p>
            </CardContent>
          </Card>

          {/* CTA */}
          <div className="text-center pt-4">
            <Button 
              size="lg" 
              onClick={handleContinue}
              className="px-8"
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
