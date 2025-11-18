import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

// Step components
import AuthStep from "@/components/onboarding/AuthStep";
import EmailVerificationStep from "@/components/onboarding/EmailVerificationStep";
import ZillowImportStep from "@/components/onboarding/ZillowImportStep";
import PricingSummary from "@/components/onboarding/PricingSummary";

interface OnboardingFunnelData {
  userId?: string;
  email?: string;
  fullName?: string;
  brokerageName?: string;
  phone?: string;
  website?: string;
  state?: string;
  licenseNumber?: string;
  bio?: string;
  specialties?: string[];
  cities?: string[];
  zipCodes?: Array<{ code: string; rating: number }>;
  zillowUrl?: string;
  yearsExperience?: number;
}

const AgentOnboardingFunnel = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<OnboardingFunnelData>({ });
  const [loading, setLoading] = useState(true);
  const [applicationId, setApplicationId] = useState<string | null>(null);

  const totalSteps = 12;

  useEffect(() => {
    checkExistingApplication();
  }, []);

  const checkExistingApplication = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const { data: app, error } = await supabase
          .from('agent_applications')
          .select('*')
          .eq('user_id', session.user.id)
          .single();

        if (!error && app) {
          setApplicationId(app.id);
          setData({
            fullName: app.full_name,
            brokerageName: app.brokerage_name,
            email: app.email,
            phone: app.phone,
            website: app.website,
            state: app.state,
            licenseNumber: app.license_number,
            bio: app.bio,
            specialties: app.selected_specialties || [],
            cities: app.cities || [],
          });
          setCurrentStep(app.current_step || 1);
        }
      }
    } catch (error) {
      console.error('Error loading application:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateData = async (newData: Partial<OnboardingFunnelData>) => {
    const updated = { ...data, ...newData };
    setData(updated);

    // Auto-save logic would go here
  };

  const nextStep = () => setCurrentStep(currentStep + 1);
  const prevStep = () => setCurrentStep(currentStep - 1);

  const handleAuthComplete = async (userId: string, email: string) => {
    // Create application record
    const { data: app, error } = await supabase
      .from('agent_applications')
      .insert({
        user_id: userId,
        email,
        email_verified: false,
        full_name: '',
        brokerage_name: '',
        state: '',
        license_number: '',
        phone: '',
        website: '',
        bio: '',
        current_step: 2,
      })
      .select()
      .single();

    if (!error && app) {
      setApplicationId(app.id);
      updateData({ email });
      nextStep();
    } else {
      toast({
        title: "Error",
        description: "Failed to create application. Please try again.",
        variant: "destructive",
      });
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <AuthStep onComplete={handleAuthComplete} />;
      case 2:
        return <EmailVerificationStep data={data as any} updateData={updateData as any} onNext={nextStep} onBack={prevStep} />;
      case 3:
        return <ZillowImportStep data={data as any} updateData={updateData} onNext={nextStep} onBack={prevStep} />;
      default:
        return (
          <Card className="p-8">
            <h2 className="text-2xl font-bold mb-4">Step {currentStep} Coming Soon</h2>
            <p className="text-muted-foreground mb-4">This step is under development.</p>
            <div className="flex gap-4">
              <Button onClick={prevStep} variant="outline">Back</Button>
              <Button onClick={nextStep}>Next</Button>
            </div>
          </Card>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-8">Real Estate Agent Onboarding</h1>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="p-6 mb-6">
                <Progress value={(currentStep / totalSteps) * 100} className="mb-4" />
                <p className="text-sm text-muted-foreground text-center">
                  Step {currentStep} of {totalSteps}
                </p>
              </Card>

              {renderStep()}
            </div>

            {currentStep > 2 && (
              <div className="lg:col-span-1">
                <div className="sticky top-4">
                  <PricingSummary data={data} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentOnboardingFunnel;
