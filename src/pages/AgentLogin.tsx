import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const emailSchema = z.string().trim().email({ message: "Please enter a valid email address" });

export default function AgentLogin() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [firstName, setFirstName] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate email
    const validation = emailSchema.safeParse(email);
    if (!validation.success) {
      toast({
        title: "Invalid email",
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Look up professional by email
      const { data: professional, error: lookupError } = await supabase
        .from("professionals")
        .select("id, name, verification_token, short_code")
        .eq("email", email.trim().toLowerCase())
        .eq("active", true)
        .maybeSingle();

      if (lookupError) {
        throw new Error("Error looking up your profile");
      }

      if (!professional) {
        toast({
          title: "Email not found",
          description: "We couldn't find an active listing with this email. Please contact us if you need help.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Extract first name
      const nameParts = professional.name.split(" ");
      const agentFirstName = nameParts[0] || "there";
      setFirstName(agentFirstName);

      // Determine the dashboard link
      const dashboardToken = professional.verification_token || professional.id;
      const dashboardUrl = `${window.location.origin}/profile/${dashboardToken}`;

      // Send the dashboard link email
      const { error: emailError } = await supabase.functions.invoke("send-dashboard-link", {
        body: {
          email: email.trim().toLowerCase(),
          name: professional.name,
          firstName: agentFirstName,
          dashboardUrl,
        },
      });

      if (emailError) {
        throw new Error("Failed to send email. Please try again.");
      }

      setSent(true);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <>
        <Helmet>
          <title>Check Your Email | Top10Lists.us</title>
          <meta name="description" content="Check your email for your dashboard link" />
        </Helmet>
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl">
                Hi {firstName}!
              </CardTitle>
              <CardDescription className="text-base">
                Please check your email for a link to your dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground mb-6">
                We sent an email to <strong>{email}</strong> with a secure link to access your profile.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSent(false);
                  setEmail("");
                  setFirstName(null);
                }}
              >
                Try a different email
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Agent Login | Top10Lists.us</title>
        <meta name="description" content="Access your Top10Lists.us agent dashboard" />
      </Helmet>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Welcome Back</CardTitle>
            <CardDescription>
              Enter your email to receive a secure link to your dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  "Send Dashboard Link"
                )}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground text-center mt-4">
              We'll send you a secure link to access your profile. No password needed.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
