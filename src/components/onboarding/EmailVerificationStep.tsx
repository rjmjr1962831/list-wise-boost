import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mail, CheckCircle } from "lucide-react";
import { ContactSupportBanner } from "./ContactSupportBanner";
import { OnboardingData } from "@/pages/AgentOnboarding";

interface EmailVerificationStepProps {
  data: OnboardingData;
  updateData: (data: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const EmailVerificationStep = ({ data, updateData, onNext, onBack }: EmailVerificationStepProps) => {
  const { toast } = useToast();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    checkVerification();
  }, []);

  const checkVerification = async () => {
    setChecking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user?.email_confirmed_at) {
        setVerified(true);
        updateData({ licenseVerified: true });
      }
    } catch (error) {
      console.error('Error checking verification:', error);
    } finally {
      setChecking(false);
    }
  };

  const resendVerificationEmail = async () => {
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: data.email!,
      });

      if (error) throw error;

      toast({
        title: "Email sent!",
        description: "Please check your inbox for the verification link.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to resend email",
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="space-y-4">
      <ContactSupportBanner />
      <Card className="p-8">
      <div className="text-center mb-6">
        {verified ? (
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        ) : (
          <Mail className="h-16 w-16 text-primary mx-auto mb-4" />
        )}
        
        <h2 className="text-2xl font-bold mb-2">
          {verified ? "Email Verified!" : "Verify Your Email"}
        </h2>
        
        <p className="text-muted-foreground">
          {verified 
            ? "Your email has been successfully verified. You can now continue with your application."
            : `We sent a verification link to ${data.email}. Please check your inbox and click the link to verify your email.`
          }
        </p>
      </div>

      {!verified && (
        <div className="space-y-4">
          <Button 
            onClick={checkVerification} 
            className="w-full"
            disabled={checking}
          >
            {checking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              "I've Verified My Email"
            )}
          </Button>

          <Button 
            onClick={resendVerificationEmail}
            variant="outline"
            className="w-full"
            disabled={resending}
          >
            {resending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Resend Verification Email"
            )}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Check your spam folder if you don't see the email
          </div>
        </div>
      )}

      {verified && (
        <div className="flex gap-4">
          <Button onClick={onBack} variant="outline" className="flex-1">
            Back
          </Button>
          <Button onClick={onNext} className="flex-1">
            Continue
          </Button>
        </div>
      )}
      </Card>
    </div>
  );
};

export default EmailVerificationStep;
