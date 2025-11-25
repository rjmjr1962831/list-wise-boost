import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProfessionalCard } from '@/components/ProfessionalCard';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { BarChart3, Edit, LogOut, Settings } from 'lucide-react';
import { Professional } from '@/types/professional';

export default function AgentDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    checkAuthAndLoadProfile();
  }, []);

  const checkAuthAndLoadProfile = async () => {
    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('Please sign in to access your dashboard');
        navigate('/agent-setup');
        return;
      }

      setUserEmail(user.email || '');

      // Fetch professional profile using user's email
      const { data, error } = await supabase
        .from('professionals')
        .select(`
          *,
          city_id (
            id,
            name,
            slug,
            state,
            state_slug
          ),
          category_id (
            id,
            name,
            slug
          )
        `)
        .eq('email', user.email)
        .eq('active', true)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        toast.error('Could not load your profile. Please contact support.');
        return;
      }

      if (data) {
        // Transform the data to match Professional type
        const transformedProfessional: Professional = {
          id: data.id,
          rank: data.rank,
          name: data.name,
          title: data.title || '',
          company: data.company || '',
          rating: data.review_stars_rating || 0,
          reviews: data.num_total_reviews || 0,
          specialties: data.specialty || [],
          address: data.address || '',
          phone: data.phone || '',
          email: data.email || '',
          website: data.website || '',
          description: data.get_to_know_me || data.description || '',
          stats: {
            totalSales: data.total_sales || (data.agent_sales_stats as any)?.countAllTime || 0,
            currentListings: data.current_listings || 0,
            yearsExperience: data.years_experience || 0,
          },
          verified: !!data.license_verified_at,
          image: data.image_url || '',
          license_number: data.license_number || '',
          license_verified_at: data.license_verified_at || '',
          zuid: data.zuid,
          years_experience: data.years_experience,
          // Pass through raw fields used by ProfessionalCard for stats & external links
          ...(data.total_sales !== null && { total_sales: data.total_sales }),
          agent_sales_stats: data.agent_sales_stats as any,
          zillow_profile_url: data.zillow_profile_url || null,
          sidebar_video_url: data.sidebar_video_url || null,
        } as any;

        setProfessional(transformedProfessional);
      }
    } catch (error) {
      console.error('Error in checkAuthAndLoadProfile:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success('Signed out successfully');
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <Skeleton className="h-12 w-64 mb-8" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!professional) {
    return (
      <div className="min-h-screen bg-background py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground mb-4">No profile found for your account.</p>
              <Button onClick={() => navigate('/agent-setup')}>
                Set Up Your Profile
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header with actions */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Agent Dashboard</h1>
            <p className="text-muted-foreground mt-1">Welcome back, {professional.name}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Edit className="h-5 w-5 text-primary" />
                Edit Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Update your information, specialties, and bio
              </p>
            </CardContent>
          </Card>

          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-5 w-5 text-primary" />
                View Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Track your profile views and engagement
              </p>
            </CardContent>
          </Card>

          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className="h-5 w-5 text-primary" />
                Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Manage your listing preferences and visibility
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Professional Card Preview */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Your Public Profile</h2>
          <ProfessionalCard
            professional={professional}
            accentColor="primary"
            schemaType="RealEstateAgent"
            market={professional.address}
            stateAbbr="AZ"
            agentType="established"
            citySlug=""
            categorySlug=""
            quizCompleted={false}
            showContactModal={false}
          />
        </div>
      </div>
    </div>
  );
}
