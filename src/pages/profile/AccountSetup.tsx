import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, Phone, CheckCircle2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type PageState = 'loading' | 'ready' | 'sending' | 'sent' | 'error';

export default function AccountSetup() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [pageState, setPageState] = useState<PageState>('loading');
  const [professional, setProfessional] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [originalEmail, setOriginalEmail] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchProfessional();
  }, [token]);

  const fetchProfessional = async () => {
    if (!token) {
      setPageState('error');
      return;
    }

    try {
      // Try to find by verification_token first, then by id
      let { data, error } = await supabase
        .from('professionals')
        .select('id, name, email, phone')
        .eq('verification_token', token)
        .maybeSingle();

      // Fallback to UUID lookup
      if (!data && !error) {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
        if (isUUID) {
          const fallback = await supabase
            .from('professionals')
            .select('id, name, email, phone')
            .eq('id', token)
            .maybeSingle();
          data = fallback.data;
          error = fallback.error;
        }
      }

      if (error || !data) {
        console.error('Error fetching professional:', error);
        setPageState('error');
        return;
      }

      setProfessional(data);
      setEmail(data.email || '');
      setOriginalEmail(data.email || '');
      setPhone(data.phone || '');
      setPageState('ready');
    } catch (err) {
      console.error('Error:', err);
      setPageState('error');
    }
  };

  const handleSendMagicLink = async () => {
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address.",
        variant: "destructive"
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive"
      });
      return;
    }

    setPageState('sending');

    try {
      // If email was changed, update it in the database
      if (email !== originalEmail && professional?.id) {
        const { error: updateError } = await supabase
          .from('professionals')
          .update({ email, phone })
          .eq('id', professional.id);

        if (updateError) {
          console.error('Error updating email:', updateError);
        }
      }

      // Send magic link using Supabase Auth
      const redirectUrl = `${window.location.origin}/profile/${token}/listing`;
      
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            professional_id: professional?.id,
            funnel_token: token
          }
        }
      });

      if (error) {
        console.error('Error sending magic link:', error);
        toast({
          title: "Error sending email",
          description: error.message,
          variant: "destructive"
        });
        setPageState('ready');
        return;
      }

      setPageState('sent');
      toast({
        title: "Magic link sent!",
        description: "Check your email for the login link."
      });
    } catch (err: any) {
      console.error('Error:', err);
      toast({
        title: "Error",
        description: err.message || "Failed to send magic link.",
        variant: "destructive"
      });
      setPageState('ready');
    }
  };

  const handleSkip = () => {
    // Allow skipping for now - they can still view their listing
    navigate(`/profile/${token}/listing`);
  };

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (pageState === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-6">
              We couldn't find your profile. Please try again or contact support.
            </p>
            <Button onClick={() => navigate('/check-profile')}>
              Look Up My Profile
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pageState === 'sent') {
    return (
      <>
        <Helmet>
          <title>Check Your Email | Top10Lists</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-8 pb-8 text-center space-y-6">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Check Your Email</h2>
                <p className="text-muted-foreground">
                  We sent a magic link to <span className="font-medium text-foreground">{email}</span>
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                <p>Click the link in your email to continue setting up your profile. The link will expire in 1 hour.</p>
              </div>

              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Didn't receive it? Check your spam folder or
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => setPageState('ready')}
                >
                  Try again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  const firstName = professional?.name?.split(' ')[0] || 'there';

  return (
    <>
      <Helmet>
        <title>Set Up Your Account | Top10Lists</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-12 px-4">
        <div className="max-w-lg mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">Let's set up your account quickly</h1>
            <p className="text-muted-foreground">
              Hi {firstName}! We've populated the information we have for you. Confirm or update it below.
            </p>
          </div>

          {/* Form Card */}
          <Card>
            <CardHeader>
              <CardTitle>Confirm Your Contact Info</CardTitle>
              <CardDescription>
                We'll send a magic link to your email to verify your identity. No password needed!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="text-lg"
                />
                {!email && (
                  <p className="text-sm text-yellow-600">
                    We don't have an email on file. Please enter one.
                  </p>
                )}
              </div>

              {/* Phone Field */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="text-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Optional - We may use this for SMS notifications in the future.
                </p>
              </div>

              {/* Submit Button */}
              <Button 
                className="w-full text-lg py-6 h-auto"
                onClick={handleSendMagicLink}
                disabled={pageState === 'sending' || !email}
              >
                {pageState === 'sending' ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    Send Magic Link
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>

              {/* Skip Option */}
              <div className="text-center">
                <button 
                  onClick={handleSkip}
                  className="text-sm text-muted-foreground hover:text-foreground underline"
                >
                  Skip for now - I'll set up my account later
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Info */}
          <div className="text-center text-sm text-muted-foreground">
            <p>
              We use magic links for secure, passwordless authentication. 
              Simply click the link we send to your email to log in.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
