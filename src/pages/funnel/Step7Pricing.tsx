import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, Check, Star, Crown, Zap } from 'lucide-react';
import { toast } from 'sonner';

const tiers = [
  {
    id: 'basic',
    name: 'Basic Listing',
    price: '$99/month',
    icon: Star,
    features: [
      'Listed in your selected cities',
      'Basic profile with contact info',
      'Shown in search results',
      'Monthly profile updates',
    ],
  },
  {
    id: 'premium',
    name: 'Premium Listing',
    price: '$299/month',
    icon: Crown,
    popular: true,
    features: [
      'Everything in Basic',
      'Featured placement in search results',
      'Neighborhood expertise badges',
      'Weekly profile updates',
      'Client review highlights',
      'Priority support',
    ],
  },
  {
    id: 'elite',
    name: 'Elite Listing',
    price: '$599/month',
    icon: Zap,
    features: [
      'Everything in Premium',
      'Top placement in all results',
      'Exclusive neighborhood expert status',
      'Real-time profile updates',
      'Featured on homepage',
      'Monthly performance reports',
      'Dedicated account manager',
    ],
  },
];

export default function Step7Pricing() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState('premium');
  const [professionalName, setProfessionalName] = useState('');

  useEffect(() => {
    loadProfessional();
  }, [token]);

  const loadProfessional = async () => {
    if (!token) {
      navigate('/404');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('professionals')
        .select('id, name')
        .eq('verification_token', token)
        .single();

      if (error || !data) {
        navigate('/404');
        return;
      }

      setProfessionalName(data.name);
    } catch (err) {
      navigate('/404');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = () => {
    const selectedTierData = tiers.find(t => t.id === selectedTier);
    toast.success(`${selectedTierData?.name} selected! Proceeding to checkout...`);
    
    // In a real implementation, this would integrate with Stripe or similar
    // For now, just navigate to success
    navigate(`/funnel/${token}/success`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Choose Your Tier | Top10Lists.us</title>
      </Helmet>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Step 6 of 7</span>
                <span className="text-sm font-medium">Choose Your Tier</span>
              </div>
              <CardTitle className="text-2xl">Select your visibility level</CardTitle>
              <p className="text-muted-foreground">
                Choose the plan that best fits your business goals. Cancel anytime.
              </p>
            </CardHeader>
            <CardContent>
              <RadioGroup value={selectedTier} onValueChange={setSelectedTier}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                  {tiers.map((tier) => {
                    const Icon = tier.icon;
                    return (
                      <div
                        key={tier.id}
                        className={`relative border-2 rounded-lg p-6 cursor-pointer transition-all ${
                          selectedTier === tier.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => setSelectedTier(tier.id)}
                      >
                        {tier.popular && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                              Most Popular
                            </span>
                          </div>
                        )}

                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Icon className="h-5 w-5 text-primary" />
                              <h3 className="font-semibold text-lg">{tier.name}</h3>
                            </div>
                            <p className="text-3xl font-bold">{tier.price}</p>
                          </div>
                          <RadioGroupItem value={tier.id} id={tier.id} />
                        </div>

                        <ul className="space-y-3">
                          {tier.features.map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </RadioGroup>

              <div className="mt-8 flex justify-center">
                <Button onClick={handleCheckout} size="lg" className="gap-2">
                  Continue to Checkout
                  <Check className="h-4 w-4" />
                </Button>
              </div>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Questions about pricing? Call us at <a href="tel:6027589600" className="underline">(602) 758-9600</a>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
