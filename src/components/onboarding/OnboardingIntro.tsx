import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Clock, FileCheck, MapPin } from 'lucide-react';
import { ContactSupportBanner } from './ContactSupportBanner';

interface OnboardingIntroProps {
  onNext: () => void;
}

export function OnboardingIntro({ onNext }: OnboardingIntroProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <ContactSupportBanner />
      <Card className="border-primary/20 shadow-lg">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary via-sunset-orange to-terracotta bg-clip-text text-transparent">
            Welcome to Top10Lists.us
          </CardTitle>
          <CardDescription className="text-lg mt-2">
            Join our exclusive network of top-performing real estate agents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="prose prose-sm max-w-none">
            <p className="text-muted-foreground text-center">
              Complete your profile in just a few minutes and start connecting with qualified home buyers and sellers in your area.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10">
              <FileCheck className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-sm mb-1">Basic Information</h4>
                <p className="text-xs text-muted-foreground">
                  License verification, bio, and contact details
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg bg-sunset-orange/5 border border-sunset-orange/10">
              <CheckCircle2 className="h-5 w-5 text-sunset-orange mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-sm mb-1">Specialties</h4>
                <p className="text-xs text-muted-foreground">
                  Highlight your areas of expertise
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg bg-terracotta/5 border border-terracotta/10">
              <MapPin className="h-5 w-5 text-terracotta mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-sm mb-1">Service Areas</h4>
                <p className="text-xs text-muted-foreground">
                  Select cities and zip codes you serve
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg bg-turquoise/5 border border-turquoise/10">
              <Clock className="h-5 w-5 text-turquoise mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-sm mb-1">Quick Process</h4>
                <p className="text-xs text-muted-foreground">
                  Takes only 5-10 minutes to complete
                </p>
              </div>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 border border-border/50">
            <p className="text-sm text-muted-foreground text-center">
              <strong className="text-foreground">Note:</strong> All information will be reviewed before publication. You'll receive a confirmation email once approved.
            </p>
          </div>

          <div className="flex justify-center pt-4">
            <Button 
              onClick={onNext}
              size="lg"
              className="bg-gradient-to-r from-primary to-sunset-orange hover:opacity-90 transition-opacity"
            >
              Get Started
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}