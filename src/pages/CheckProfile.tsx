import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, Search, Mail, Phone, CreditCard, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useGA4Tracking } from '@/hooks/useGA4Tracking';

type PageState = 'lookup' | 'searching' | 'found' | 'not-found' | 'review-submitted';

export default function CheckProfile() {
  const navigate = useNavigate();
  const { trackEvent } = useGA4Tracking();
  
  const [pageState, setPageState] = useState<PageState>('lookup');
  const [filledFields, setFilledFields] = useState(0);
  const [foundAgentName, setFoundAgentName] = useState('');

  // Lookup form fields
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [zillowLink, setZillowLink] = useState('');

  // Review request form fields
  const [fullName, setFullName] = useState('');
  const [reviewEmail, setReviewEmail] = useState('');
  const [reviewPhone, setReviewPhone] = useState('');
  const [reviewLicense, setReviewLicense] = useState('');
  const [brokerage, setBrokerage] = useState('');
  const [yearsLicensed, setYearsLicensed] = useState('');
  const [estimatedTransactions, setEstimatedTransactions] = useState('');
  const [message, setMessage] = useState('');

  // Update filled fields count
  const updateFilledCount = () => {
    let count = 0;
    if (email.trim()) count++;
    if (phone.trim()) count++;
    if (licenseNumber.trim()) count++;
    if (zillowLink.trim()) count++;
    setFilledFields(count);
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (filledFields === 0) {
      toast.error('Please fill in at least one field');
      return;
    }

    setPageState('searching');

    try {
      const { data, error } = await supabase.functions.invoke('lookup-agent', {
        body: { email, phone, licenseNumber, zillowLink },
      });

      if (error) throw error;

      trackEvent('agent_profile_click', {
        search_type: 'check_profile_lookup',
        professional_name: data.name || 'unknown',
      });

      if (data.found) {
        setFoundAgentName(data.name);
        setPageState('found');
        
        // Auto-redirect after 2 seconds
        setTimeout(() => {
          navigate(`/profile/${data.token}`);
        }, 2000);
      } else {
        setPageState('not-found');
        // Pre-fill review form with lookup data
        setReviewEmail(email);
        setReviewPhone(phone);
        setReviewLicense(licenseNumber);
      }
    } catch (error) {
      console.error('Lookup error:', error);
      toast.error('An error occurred during lookup');
      setPageState('lookup');
    }
  };

  const handleReviewRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data, error } = await supabase.functions.invoke('request-review', {
        body: {
          full_name: fullName,
          email: reviewEmail,
          phone: reviewPhone,
          license_number: reviewLicense,
          brokerage,
          years_licensed: yearsLicensed ? parseInt(yearsLicensed) : null,
          estimated_transactions: estimatedTransactions,
          message,
        },
      });

      if (error) throw error;

      trackEvent('contact_cta_click', {
        agent_name: fullName,
        category: 'review_request',
      });

      if (data.success) {
        setPageState('review-submitted');
      } else {
        toast.error('Failed to submit review request');
      }
    } catch (error) {
      console.error('Review request error:', error);
      toast.error('An error occurred submitting your request');
    }
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Lookup State */}
        {pageState === 'lookup' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">Check Your Profile</CardTitle>
              <CardDescription>
                See if you're already featured in our Top 10 list. Enter at least one piece of information below.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLookup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      updateFilledCount();
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      updateFilledCount();
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="license">License Number</Label>
                  <Input
                    id="license"
                    placeholder="SA123456789"
                    value={licenseNumber}
                    onChange={(e) => {
                      setLicenseNumber(e.target.value);
                      updateFilledCount();
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zillow">Zillow Profile URL</Label>
                  <Input
                    id="zillow"
                    placeholder="https://www.zillow.com/profile/your-name"
                    value={zillowLink}
                    onChange={(e) => {
                      setZillowLink(e.target.value);
                      updateFilledCount();
                    }}
                  />
                </div>

                <div className="flex items-center justify-between pt-4">
                  <span className="text-sm text-muted-foreground">
                    {filledFields}/4 fields filled
                  </span>
                  <Button type="submit" disabled={filledFields === 0}>
                    <Search className="mr-2 h-4 w-4" />
                    Check My Profile
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Searching State */}
        {pageState === 'searching' && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-lg">Searching our directory...</p>
            </CardContent>
          </Card>
        )}

        {/* Found State */}
        {pageState === 'found' && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
              <h2 className="text-2xl font-bold mb-2">You're on the List! 🎉</h2>
              <p className="text-muted-foreground mb-4">
                Great news, {foundAgentName}! You're featured in our directory.
              </p>
              <p className="text-sm text-muted-foreground">
                Redirecting to your profile...
              </p>
            </CardContent>
          </Card>
        )}

        {/* Not Found State */}
        {pageState === 'not-found' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Not Found Yet</CardTitle>
                <CardDescription>
                  We couldn't find you in our directory, but you may qualify! Here's what we look for:
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <RequirementCard
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    title="5+ Years Experience"
                    description="Proven track record in real estate"
                  />
                  <RequirementCard
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    title="50+ Transactions"
                    description="Demonstrated sales success"
                  />
                  <RequirementCard
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    title="4.5+ Star Rating"
                    description="Excellent client satisfaction"
                  />
                  <RequirementCard
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    title="Clean Record"
                    description="No disciplinary actions"
                  />
                  <RequirementCard
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    title="Active License"
                    description="Current and in good standing"
                  />
                  <RequirementCard
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    title="Verifiable Credentials"
                    description="Licensed and registered"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Request a Review</CardTitle>
                <CardDescription>
                  If you meet these requirements, submit your information for review.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleReviewRequest} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input
                      id="fullName"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reviewEmail">Email *</Label>
                    <Input
                      id="reviewEmail"
                      type="email"
                      required
                      value={reviewEmail}
                      onChange={(e) => setReviewEmail(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reviewPhone">Phone *</Label>
                    <Input
                      id="reviewPhone"
                      type="tel"
                      required
                      value={reviewPhone}
                      onChange={(e) => setReviewPhone(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reviewLicense">License Number *</Label>
                    <Input
                      id="reviewLicense"
                      required
                      value={reviewLicense}
                      onChange={(e) => setReviewLicense(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="brokerage">Brokerage *</Label>
                    <Input
                      id="brokerage"
                      required
                      value={brokerage}
                      onChange={(e) => setBrokerage(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="yearsLicensed">Years Licensed</Label>
                    <Input
                      id="yearsLicensed"
                      type="number"
                      min="0"
                      value={yearsLicensed}
                      onChange={(e) => setYearsLicensed(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="estimatedTransactions">Estimated Lifetime Transactions</Label>
                    <Input
                      id="estimatedTransactions"
                      placeholder="e.g., 100+"
                      value={estimatedTransactions}
                      onChange={(e) => setEstimatedTransactions(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Additional Information</Label>
                    <Textarea
                      id="message"
                      rows={4}
                      placeholder="Tell us why you should be featured..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </div>

                  <Button type="submit" className="w-full">
                    <Mail className="mr-2 h-4 w-4" />
                    Submit for Review
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Review Submitted State */}
        {pageState === 'review-submitted' && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
              <h2 className="text-2xl font-bold mb-2">Request Submitted! 📧</h2>
              <p className="text-muted-foreground text-center max-w-md">
                Thank you for your submission. Our team will review your information and contact you within 3-5 business days.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function RequirementCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 p-4 border rounded-lg bg-card">
      <div className="text-primary mt-0.5">{icon}</div>
      <div>
        <h3 className="font-semibold mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
