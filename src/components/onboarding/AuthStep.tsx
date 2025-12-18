import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { ContactSupportBanner } from "./ContactSupportBanner";
interface AuthStepProps {
  onComplete: (userId: string, email: string) => void;
}

const AuthStep = ({ onComplete }: AuthStepProps) => {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/apply/onboarding`,
          data: {
            sms_opt_in: smsOptIn,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        toast({
          title: "Account created!",
          description: "Please check your email to verify your account.",
        });
        onComplete(data.user.id, email);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create account",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <ContactSupportBanner />
      <Card className="p-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Create Your Account</h2>
          <p className="text-muted-foreground">
            Let's get started by creating your account. This will allow you to save your progress and come back anytime.
          </p>
        </div>

      <form onSubmit={handleSignUp} className="space-y-4">
        <div>
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your.email@example.com"
            required
          />
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 6 characters"
            required
          />
        </div>

        <div>
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter your password"
            required
          />
        </div>

        <div className="flex items-start space-x-3 pt-2">
          <Checkbox
            id="smsOptIn"
            checked={smsOptIn}
            onCheckedChange={(checked) => setSmsOptIn(checked === true)}
            className="mt-1"
          />
          <Label htmlFor="smsOptIn" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
            I agree to receive SMS notifications about my account, billing, and listing status from Top10Lists. Message frequency varies. Reply STOP to opt out. Msg & data rates may apply.{" "}
            <Link to="/sms-terms" className="text-primary hover:underline" target="_blank">
              SMS Terms
            </Link>
          </Label>
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Account...
            </>
          ) : (
            "Create Account & Continue"
          )}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default AuthStep;
