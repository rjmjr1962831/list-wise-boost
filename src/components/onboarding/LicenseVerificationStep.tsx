import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { OnboardingData } from "@/pages/AgentOnboarding";

interface LicenseVerificationStepProps {
  data: OnboardingData;
  updateData: (data: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const LicenseVerificationStep = ({ data, updateData, onNext, onBack }: LicenseVerificationStepProps) => {
  const { toast } = useToast();
  const [verifying, setVerifying] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [licenseNumber, setLicenseNumber] = useState(data.licenseNumber || "");
  const [verified, setVerified] = useState(data.licenseVerified || false);

  useEffect(() => {
    // Only auto-verify for Arizona agents
    if (data.state === "Arizona" && data.fullName && !verified && !manualEntry) {
      autoVerifyFromArizonaList();
    } else if (data.state !== "Arizona") {
      // For non-Arizona states, go directly to manual entry
      setManualEntry(true);
    }
  }, []);

  const autoVerifyFromArizonaList = async () => {
    if (!data.fullName) return;
    
    setVerifying(true);
    try {
      const { data: functionData, error } = await supabase.functions.invoke('lookup-agent-license', {
        body: {
          agentName: data.fullName,
          state: 'Arizona',
        }
      });

      if (error) throw error;

      if (functionData?.licenseNumber) {
        setLicenseNumber(functionData.licenseNumber);
        setVerified(true);
        updateData({ 
          licenseNumber: functionData.licenseNumber,
          licenseVerified: true 
        });
        toast({
          title: "License Verified!",
          description: `Found license number: ${functionData.licenseNumber}`,
        });
      } else {
        setManualEntry(true);
        toast({
          title: "License Not Found",
          description: "Please enter your license number manually. We'll verify it later.",
        });
      }
    } catch (error: any) {
      console.error('Error verifying license:', error);
      setManualEntry(true);
      toast({
        title: "Verification Unavailable",
        description: "Please enter your license number manually.",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleManualSubmit = () => {
    if (!licenseNumber.trim()) {
      toast({
        title: "Error",
        description: "Please enter your license number",
        variant: "destructive",
      });
      return;
    }

    updateData({ 
      licenseNumber: licenseNumber.trim(),
      licenseVerified: false // Will be verified later by admin
    });
    onNext();
  };

  if (verifying) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Verifying Your License</h2>
          <p className="text-muted-foreground">
            Checking the Arizona real estate license database...
          </p>
        </div>
      </Card>
    );
  }

  if (verified) {
    return (
      <Card className="p-8">
        <div className="text-center mb-6">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">License Verified!</h2>
          <p className="text-muted-foreground mb-4">
            Your Arizona real estate license has been successfully verified.
          </p>
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm font-medium">License Number:</p>
            <p className="text-lg font-bold">{licenseNumber}</p>
          </div>
        </div>

        <div className="flex gap-4">
          <Button onClick={onBack} variant="outline" className="flex-1">
            Back
          </Button>
          <Button onClick={onNext} className="flex-1">
            Continue
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-8">
      <div className="mb-6">
        <div className="flex items-start gap-3 mb-4">
          {data.state === "Arizona" ? (
            <AlertCircle className="h-6 w-6 text-yellow-500 mt-1" />
          ) : (
            <AlertCircle className="h-6 w-6 text-blue-500 mt-1" />
          )}
          <div>
            <h2 className="text-2xl font-bold mb-2">License Verification</h2>
            <p className="text-muted-foreground">
              {data.state === "Arizona" 
                ? "We couldn't automatically verify your Arizona license. Please enter it manually and we'll verify it with the state database."
                : `Please enter your ${data.state} real estate license number. We currently only support automatic verification for Arizona licenses, but we'll verify your license with your state's licensing board during the review process.`
              }
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="license">
            {data.state} Real Estate License Number
          </Label>
          <Input
            id="license"
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
            placeholder="Enter your license number"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {data.state === "Arizona" 
              ? "We'll verify this with the Arizona Department of Real Estate."
              : "Our team will verify this with your state's licensing board during application review."
            }
          </p>
        </div>

        <div className="flex gap-4">
          <Button onClick={onBack} variant="outline" className="flex-1">
            Back
          </Button>
          <Button onClick={handleManualSubmit} className="flex-1">
            Continue
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default LicenseVerificationStep;
