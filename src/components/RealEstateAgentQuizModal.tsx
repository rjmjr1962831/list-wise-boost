import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useGA4Tracking } from '@/hooks/useGA4Tracking';

interface QuizPreferences {
  propertyType: string;
  priceRange: string;
  timeline: string;
}

interface RealEstateAgentQuizModalProps {
  open: boolean;
  onComplete: (preferences: QuizPreferences) => void;
  city: string;
}

export function RealEstateAgentQuizModal({ open, onComplete, city }: RealEstateAgentQuizModalProps) {
  const [step, setStep] = useState(1);
  const [propertyType, setPropertyType] = useState('');
  const [priceRange, setPriceRange] = useState('');
  const [timeline, setTimeline] = useState('');
  const { trackEvent } = useGA4Tracking();

  const handleNext = () => {
    if (step === 1 && propertyType) {
      trackEvent('quiz_step_completed', {
        market: city,
        filter_type: 'property_type',
        filter_value: propertyType
      });
      setStep(2);
    } else if (step === 2 && priceRange) {
      trackEvent('quiz_step_completed', {
        market: city,
        filter_type: 'price_range',
        filter_value: priceRange
      });
      setStep(3);
    } else if (step === 3 && timeline) {
      trackEvent('quiz_completed', {
        market: city,
        filter_type: 'timeline',
        filter_value: timeline
      });
      onComplete({ propertyType, priceRange, timeline });
    }
  };

  const canProceed = (step === 1 && propertyType) || (step === 2 && priceRange) || (step === 3 && timeline);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Find Your Perfect {city} Real Estate Agent</DialogTitle>
          <DialogDescription>
            Answer 3 quick questions to get matched with agents who specialize in your needs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {step === 1 && (
            <div className="space-y-4">
              <Label className="text-base font-semibold">What type of property are you looking for?</Label>
              <RadioGroup value={propertyType} onValueChange={setPropertyType}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="land" id="land" />
                  <Label htmlFor="land" className="font-normal cursor-pointer">Land</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="single-family" id="single-family" />
                  <Label htmlFor="single-family" className="font-normal cursor-pointer">Single Family Home</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="condo" id="condo" />
                  <Label htmlFor="condo" className="font-normal cursor-pointer">Condo</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="other" id="other" />
                  <Label htmlFor="other" className="font-normal cursor-pointer">Other</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Label className="text-base font-semibold">What's your price range?</Label>
              <RadioGroup value={priceRange} onValueChange={setPriceRange}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="under-500k" id="under-500k" />
                  <Label htmlFor="under-500k" className="font-normal cursor-pointer">Under $500k</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="500k-1.5m" id="500k-1.5m" />
                  <Label htmlFor="500k-1.5m" className="font-normal cursor-pointer">$500k to $1.5M</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="over-1.5m" id="over-1.5m" />
                  <Label htmlFor="over-1.5m" className="font-normal cursor-pointer">Over $1.5M</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <Label className="text-base font-semibold">When do you anticipate closing a transaction?</Label>
              <RadioGroup value={timeline} onValueChange={setTimeline}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="under-3-months" id="under-3-months" />
                  <Label htmlFor="under-3-months" className="font-normal cursor-pointer">Less than 3 months</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="3-6-months" id="3-6-months" />
                  <Label htmlFor="3-6-months" className="font-normal cursor-pointer">3-6 months</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="over-6-months" id="over-6-months" />
                  <Label htmlFor="over-6-months" className="font-normal cursor-pointer">6+ months</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          <div className="flex justify-between pt-4">
            <div className="text-sm text-muted-foreground">
              Step {step} of 3
            </div>
            <Button onClick={handleNext} disabled={!canProceed}>
              {step === 3 ? 'See Results' : 'Next'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
