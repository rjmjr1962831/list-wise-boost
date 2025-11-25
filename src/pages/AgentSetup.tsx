import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ProfessionalCard } from '@/components/ProfessionalCard';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { Loader2, UserPlus } from 'lucide-react';
import { z } from 'zod';

const setupSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type SetupForm = z.infer<typeof setupSchema>;

export default function AgentSetup() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<SetupForm>({
    email: '',
    firstName: '',
    lastName: '',
    city: '',
    state: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [matchedAgent, setMatchedAgent] = useState<any>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof SetupForm, string>>>({});

  const handleInputChange = (field: keyof SetupForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const result = setupSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof SetupForm, string>> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as keyof SetupForm] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Check if agent exists in database by email
      const { data: existingAgent, error: searchError } = await supabase
        .from('professionals')
        .select(`
          *,
          city:cities(name, state, slug, state_slug),
          category:categories(name, plural_name, slug)
        `)
        .eq('email', formData.email.toLowerCase().trim())
        .eq('active', true)
        .maybeSingle();

      if (searchError) {
        console.error('Error searching for agent:', searchError);
        toast.error('Error searching for your listing');
        setIsLoading(false);
        return;
      }

      if (existingAgent) {
        // Agent found - show their card
        setMatchedAgent(existingAgent);
        setIsLoading(false);
        toast.success('We found your listing!');
      } else {
        // Agent not found - fetch from Zillow
        setIsFetching(true);
        toast.info('Searching for your profile...');

        // Call the edge function to fetch agent data
        const { data: fetchResult, error: fetchError } = await supabase.functions.invoke(
          'search-and-import-agent',
          {
            body: {
              email: formData.email,
              firstName: formData.firstName,
              lastName: formData.lastName,
              city: formData.city,
              state: formData.state,
            }
          }
        );

        if (fetchError) {
          console.error('Error fetching agent:', fetchError);
          toast.error('Could not find your profile. Please verify your information.');
          setIsFetching(false);
          setIsLoading(false);
          return;
        }

        // After successful fetch, query the database again
        const { data: newAgent, error: newSearchError } = await supabase
          .from('professionals')
          .select(`
            *,
            city:cities(name, state, slug, state_slug),
            category:categories(name, plural_name, slug)
          `)
          .eq('email', formData.email.toLowerCase().trim())
          .eq('active', true)
          .maybeSingle();

        setIsFetching(false);

        if (newSearchError || !newAgent) {
          toast.error('Could not retrieve your profile. Please contact support.');
          setIsLoading(false);
          return;
        }

        setMatchedAgent(newAgent);
        setIsLoading(false);
        toast.success('Profile found and loaded!');
      }

      // Create or sign in to user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
          }
        }
      });

      // If user already exists, sign them in instead
      if (authError?.message?.includes('already registered')) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        
        if (signInError) {
          toast.error('Incorrect password. Please try again.');
          setIsLoading(false);
          return;
        }
        
        toast.success('Welcome back! Signed in successfully.');
      } else if (authError) {
        console.error('Auth error:', authError);
        toast.error(authError.message);
        setIsLoading(false);
        return;
      } else if (authData.user) {
        toast.success('Account created! Please check your email to verify.');
      }

    } catch (error) {
      console.error('Setup error:', error);
      toast.error('An error occurred. Please try again.');
      setIsLoading(false);
      setIsFetching(false);
    }
  };

  if (isFetching) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/20 px-4">
        <Helmet>
          <title>Finding Your Profile | Top10Lists</title>
        </Helmet>
        <Card className="w-full max-w-lg text-center p-8">
          <Loader2 className="w-16 h-16 animate-spin text-primary mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-4">Searching for Your Profile</h2>
          <p className="text-muted-foreground mb-6">
            We're scanning Zillow and other sources to find your information...
          </p>
          <AnimatedCounter 
            target={2000000} 
            duration={8} 
            isLoading={true}
            className="text-4xl font-bold text-primary"
          />
          <p className="text-sm text-muted-foreground mt-2">listings scanned</p>
        </Card>
      </div>
    );
  }

  if (matchedAgent) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-16 px-4">
        <Helmet>
          <title>Your Profile | Top10Lists</title>
        </Helmet>
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              Here's Your Current Profile
            </h1>
            <p className="text-muted-foreground">
              Review your information and continue to set up your premium listing
            </p>
          </div>

          <ProfessionalCard 
            professional={{
              id: matchedAgent.id,
              rank: matchedAgent.rank,
              name: matchedAgent.name,
              title: matchedAgent.title || undefined,
              company: matchedAgent.company || 'NA',
              rating: matchedAgent.review_stars_rating || 0,
              reviews: matchedAgent.num_total_reviews || 0,
              specialties: matchedAgent.specialty || [],
              address: matchedAgent.address || 'NA',
              phone: matchedAgent.phone || 'NA',
              email: matchedAgent.email || 'NA',
              website: matchedAgent.website || 'NA',
              description: matchedAgent.description || matchedAgent.get_to_know_me || '',
              stats: {
                yearsExperience: matchedAgent.years_experience,
                currentListings: matchedAgent.current_listings,
                totalSales: matchedAgent.total_sales,
              },
              verified: !!matchedAgent.license_verified_at,
              image: matchedAgent.image_url || '',
              license_number: matchedAgent.license_number || undefined,
              license_verified_at: matchedAgent.license_verified_at || undefined,
              years_experience: matchedAgent.years_experience || undefined,
              zuid: matchedAgent.zuid || undefined,
            }}
          />

          <div className="mt-8 text-center">
            <Button 
              size="lg"
              onClick={() => navigate('/agent-onboarding')}
              className="px-8"
            >
              Continue to Premium Setup
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-16 px-4">
      <Helmet>
        <title>Join Top10Lists | Premium Agent Setup</title>
        <meta name="description" content="Set up your premium agent listing on Top10Lists" />
      </Helmet>

      <div className="container mx-auto max-w-lg">
        <Card>
          <CardHeader className="text-center">
            <UserPlus className="w-12 h-12 text-primary mx-auto mb-4" />
            <CardTitle className="text-2xl md:text-3xl">Agent Access</CardTitle>
            <CardDescription>
              Enter your information to claim your listing or sign in to your existing account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    disabled={isLoading}
                    required
                  />
                  {errors.firstName && (
                    <p className="text-sm text-destructive">{errors.firstName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    disabled={isLoading}
                    required
                  />
                  {errors.lastName && (
                    <p className="text-sm text-destructive">{errors.lastName}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Business Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  disabled={isLoading}
                  required
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    type="text"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    disabled={isLoading}
                    required
                  />
                  {errors.city && (
                    <p className="text-sm text-destructive">{errors.city}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    type="text"
                    value={formData.state}
                    onChange={(e) => handleInputChange('state', e.target.value)}
                    disabled={isLoading}
                    placeholder="e.g., AZ"
                    required
                  />
                  {errors.state && (
                    <p className="text-sm text-destructive">{errors.state}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  disabled={isLoading}
                  required
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password}</p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Find My Listing & Continue'
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                By continuing, you agree to our Terms of Service and Privacy Policy
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
