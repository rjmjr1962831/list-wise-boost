import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Footer } from '@/components/Footer';
import { Progress } from '@/components/ui/progress';
import { OnboardingIntro } from '@/components/onboarding/OnboardingIntro';
import { BasicInfoStep } from '@/components/onboarding/BasicInfoStep';
import { SpecialtiesStep } from '@/components/onboarding/SpecialtiesStep';
import { LocationsStep } from '@/components/onboarding/LocationsStep';
import { ZipCodesStep } from '@/components/onboarding/ZipCodesStep';
import { PreviewStep } from '@/components/onboarding/PreviewStep';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface OnboardingData {
  fullName: string;
  brokerageName: string;
  isTeamMember: boolean;
  teamName?: string;
  bio: string;
  licenseNumber: string;
  licenseVerified: boolean;
  website: string;
  email: string;
  publishEmail: boolean;
  phone: string;
  smsConsent: boolean;
  hasZillowHomeLinks: boolean;
  zillowUrl?: string;
  
  homeUrl?: string;
  specialties: string[];
  state: string;
  stateSlug: string;
  cities: string[];
  zipCodes: { [cityId: string]: string[] };
  yearsExperience: number;
}

const TOTAL_STEPS = 6;

export default function AgentOnboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    fullName: '',
    brokerageName: '',
    isTeamMember: false,
    bio: '',
    licenseNumber: '',
    licenseVerified: false,
    website: '',
    email: '',
    publishEmail: false,
    phone: '',
    smsConsent: false,
    hasZillowHomeLinks: false,
    specialties: [],
    state: '',
    stateSlug: '',
    cities: [],
    zipCodes: {},
    yearsExperience: 0,
  });

  const updateData = (newData: Partial<OnboardingData>) => {
    setOnboardingData((prev) => ({ ...prev, ...newData }));
  };

  const nextStep = () => {
    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep((prev) => prev + 1);
      window.scrollTo(0, 0);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleSubmit = async () => {
    try {
      // Save to database
      const { error } = await (supabase as any).from('agent_applications').insert({
        full_name: onboardingData.fullName,
        brokerage_name: onboardingData.brokerageName,
        is_team_member: onboardingData.isTeamMember,
        team_name: onboardingData.teamName,
        bio: onboardingData.bio,
        license_number: onboardingData.licenseNumber,
        license_verified: onboardingData.licenseVerified,
        website: onboardingData.website,
        email: onboardingData.email,
        publish_email: onboardingData.publishEmail,
        phone: onboardingData.phone,
        zillow_url: onboardingData.zillowUrl,
        redfin_url: null,
        home_url: onboardingData.homeUrl,
        specialties: onboardingData.specialties,
        state: onboardingData.state,
        cities: onboardingData.cities,
        zip_codes: onboardingData.zipCodes,
        status: 'pending',
      });

      if (error) throw error;

      toast.success('Application submitted successfully!');
      navigate('/agent-onboarding/payment');
    } catch (error) {
      console.error('Error submitting application:', error);
      toast.error('Failed to submit application. Please try again.');
    }
  };

  const progressPercent = ((currentStep + 1) / TOTAL_STEPS) * 100;

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <OnboardingIntro onNext={nextStep} />;
      case 1:
        return (
          <BasicInfoStep
            data={onboardingData}
            updateData={updateData}
            onNext={nextStep}
            onBack={prevStep}
          />
        );
      case 2:
        return (
          <SpecialtiesStep
            data={onboardingData}
            updateData={updateData}
            onNext={nextStep}
            onBack={prevStep}
          />
        );
      case 3:
        return (
          <LocationsStep
            data={onboardingData}
            updateData={updateData}
            onNext={nextStep}
            onBack={prevStep}
          />
        );
      case 4:
        return (
          <ZipCodesStep
            data={onboardingData}
            updateData={updateData}
            onNext={nextStep}
            onBack={prevStep}
          />
        );
      case 5:
        return (
          <PreviewStep
            data={onboardingData}
            onSubmit={handleSubmit}
            onBack={prevStep}
            onEdit={() => setCurrentStep(1)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Helmet>
        <title>Agent Onboarding | Top10Lists.us</title>
        <meta name="description" content="Join Top10Lists.us as a featured real estate agent. Complete your profile and start connecting with clients." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-primary/5">
        <h1 className="sr-only">Agent Onboarding - Join Top10Lists.us</h1>
        <main className="flex-1 container max-w-4xl mx-auto px-4 py-8">
          {currentStep > 0 && (
            <div className="mb-8">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">
                  Step {currentStep} of {TOTAL_STEPS - 1}
                </span>
                <span className="text-sm font-medium text-primary">
                  {Math.round(progressPercent)}% Complete
                </span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          )}

          {renderStep()}
        </main>

        <Footer />
      </div>
    </>
  );
}
