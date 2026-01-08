import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck, ArrowLeft, RefreshCw } from "lucide-react";

const AgentCodeVerify = () => {
  const navigate = useNavigate();
  const [code, setCode] = useState<string[]>(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const email = sessionStorage.getItem("agent_verify_email");

  // Redirect if no email in session
  useEffect(() => {
    if (!email) {
      navigate("/agent/login");
    }
  }, [email, navigate]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleInputChange = useCallback((index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, "").slice(-1);
    
    setCode((prev) => {
      const newCode = [...prev];
      newCode[index] = digit;
      return newCode;
    });
    setError("");

    // Auto-focus next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }, []);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [code]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    
    if (pastedData.length > 0) {
      const newCode = [...code];
      for (let i = 0; i < pastedData.length && i < 6; i++) {
        newCode[i] = pastedData[i];
      }
      setCode(newCode);
      setError("");
      
      // Focus the appropriate input
      const focusIndex = Math.min(pastedData.length, 5);
      inputRefs.current[focusIndex]?.focus();
    }
  }, [code]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    const fullCode = code.join("");
    if (fullCode.length !== 6) {
      setError("Please enter all 6 digits");
      return;
    }

    if (!email) {
      navigate("/agent/login");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const { data, error: verifyError } = await supabase.functions.invoke("verify-agent-code", {
        body: { email, code: fullCode },
      });

      if (verifyError) {
        console.error("Verification error:", verifyError);
        if (verifyError.message?.includes("429")) {
          setError("Too many failed attempts. Please try again later.");
        } else {
          setError("Invalid or expired code. Please try again.");
        }
        setCode(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        setIsLoading(false);
        return;
      }

      if (!data?.success) {
        setError(data?.error || "Invalid or expired code. Please try again.");
        setCode(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        setIsLoading(false);
        return;
      }

      // Store session token
      localStorage.setItem("agent_session_token", data.sessionToken);
      
      // Clear the email from session storage
      sessionStorage.removeItem("agent_verify_email");

      toast({
        title: "Success!",
        description: "You've been logged in successfully.",
      });

      // Navigate to dashboard
      navigate(data.redirectUrl || "/agent/dashboard");

    } catch (error) {
      console.error("Unexpected error:", error);
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || !email) return;

    setIsResending(true);

    try {
      const { error } = await supabase.functions.invoke("send-agent-verification-code", {
        body: { email },
      });

      if (error) {
        if (error.message?.includes("429")) {
          toast({
            title: "Too many requests",
            description: "Please wait before requesting another code.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: "Failed to resend code. Please try again.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Code sent",
          description: "A new verification code has been sent to your email.",
        });
        setResendCooldown(60);
        setCode(["", "", "", "", "", ""]);
        setError("");
        inputRefs.current[0]?.focus();
      }
    } catch (error) {
      console.error("Resend error:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  // Auto-submit when all digits are entered
  useEffect(() => {
    const fullCode = code.join("");
    if (fullCode.length === 6 && !isLoading) {
      handleSubmit();
    }
  }, [code, isLoading]);

  return (
    <>
      <Helmet>
        <title>Verify Code | Top10Lists.us</title>
        <meta name="description" content="Enter your verification code to access your dashboard" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Enter Verification Code</CardTitle>
            <CardDescription>
              We sent a 6-digit code to{" "}
              <span className="font-medium text-foreground">{email}</span>
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 6-digit code input */}
              <div className="flex justify-center gap-2" onPaste={handlePaste}>
                {code.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleInputChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    disabled={isLoading}
                    className={`
                      w-12 h-14 text-center text-2xl font-bold
                      border rounded-lg
                      focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary
                      disabled:opacity-50 disabled:cursor-not-allowed
                      transition-all
                      ${error ? "border-destructive" : "border-input"}
                      ${digit ? "bg-primary/5" : "bg-background"}
                    `}
                    aria-label={`Digit ${index + 1}`}
                  />
                ))}
              </div>

              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || code.join("").length !== 6}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify Code"
                )}
              </Button>
            </form>

            {/* Resend code */}
            <div className="mt-6 text-center">
              <button
                onClick={handleResendCode}
                disabled={resendCooldown > 0 || isResending}
                className={`
                  inline-flex items-center text-sm
                  ${resendCooldown > 0 || isResending
                    ? "text-muted-foreground cursor-not-allowed"
                    : "text-primary hover:underline cursor-pointer"
                  }
                `}
              >
                {isResending ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Sending...
                  </>
                ) : resendCooldown > 0 ? (
                  <>
                    <RefreshCw className="mr-2 h-3 w-3" />
                    Resend code in {resendCooldown}s
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-3 w-3" />
                    Resend code
                  </>
                )}
              </button>
            </div>

            {/* Back to email entry */}
            <div className="mt-4 pt-4 border-t text-center">
              <button
                onClick={() => {
                  sessionStorage.removeItem("agent_verify_email");
                  navigate("/agent/login");
                }}
                className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="mr-2 h-3 w-3" />
                Use a different email
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default AgentCodeVerify;
