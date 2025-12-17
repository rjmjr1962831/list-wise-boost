import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProfessionalCard } from '@/components/ProfessionalCard';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { 
  CreditCard, 
  Edit, 
  LogOut, 
  MapPin, 
  Eye, 
  Lock,
  ArrowUpCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { Professional } from '@/types/professional';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AvailableCity {
  id: string;
  name: string;
}

interface CitySubscription {
  id: string;
  city_name: string;
  subscription_type: string;
  is_active: boolean;
  started_at: string;
  expires_at: string | null;
}

export default function AgentDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<CitySubscription[]>([]);
  const [freeCity, setFreeCity] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [isAdminViewing, setIsAdminViewing] = useState(false);
  const [availableCities, setAvailableCities] = useState<AvailableCity[]>([]);
  const [selectedFreeCityId, setSelectedFreeCityId] = useState<string>('');
  const [savingFreeCity, setSavingFreeCity] = useState(false);

  // Premium cities not eligible for free listing
  const PREMIUM_CITY_NAMES = ['Scottsdale', 'Paradise Valley', 'Carefree', 'Cave Creek', 'Sedona'];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    checkAuthAndLoadProfile();
  }, [searchParams]);

  useEffect(() => {
    // Load available cities for free city selector
    const loadCities = async () => {
      const { data } = await supabase
        .from('cities')
        .select('id, name')
        .eq('active', true)
        .eq('state', 'Arizona')
        .order('name');
      
      if (data) {
        const filtered = data.filter(c => !PREMIUM_CITY_NAMES.includes(c.name));
        setAvailableCities(filtered);
      }
    };
    loadCities();
  }, []);

  const handleSaveFreeCity = async () => {
    if (!selectedFreeCityId || !professionalId) return;
    
    setSavingFreeCity(true);
    try {
      const { error } = await supabase.functions.invoke('update-professional-field', {
        body: {
          token: professionalId,
          field: 'city_id',
          value: selectedFreeCityId
        }
      });

      if (error) throw error;

      const selectedCity = availableCities.find(c => c.id === selectedFreeCityId);
      setFreeCity(selectedCity?.name || null);
      setSelectedFreeCityId('');
      toast.success('Free city updated successfully');
      
      // Reload to refresh subscriptions
      checkAuthAndLoadProfile();
    } catch (error: any) {
      console.error('Error saving free city:', error);
      toast.error(error.message || 'Failed to update free city');
    } finally {
      setSavingFreeCity(false);
    }
  };

  const checkAuthAndLoadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('Please sign in to access your dashboard');
        navigate('/auth');
        return;
      }

      // Check if admin is viewing a specific professional via query param
      const viewId = searchParams.get('id');
      
      if (viewId) {
        // Verify user is admin
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .single();

        if (roleData) {
          setIsAdminViewing(true);
          // Fetch specific professional by ID
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
            .eq('id', viewId)
            .single();

          if (!error && data) {
            return loadProfileData(data);
          }
        }
      }

      // Normal flow: fetch by email
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

      if (error || !data) {
        console.error('Error fetching profile:', error);
        toast.error('Could not load your profile. Please contact support.');
        setLoading(false);
        return;
      }

      loadProfileData(data);
    } catch (error) {
      console.error('Error in checkAuthAndLoadProfile:', error);
      toast.error('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  const loadProfileData = async (data: any) => {
    try {
      setProfessionalId(data.id);
      setVerificationToken(data.verification_token || data.id);

      // Fetch city subscriptions
      const { data: subs } = await supabase
        .from('agent_city_subscriptions')
        .select(`
          id,
          subscription_type,
          is_active,
          started_at,
          expires_at,
          city_id (
            city_name
          )
        `)
        .eq('professional_id', data.id);

      if (subs && subs.length > 0) {
        const formattedSubs = subs.map((sub: any) => ({
          id: sub.id,
          city_name: sub.city_id?.city_name || 'Unknown',
          subscription_type: sub.subscription_type,
          is_active: sub.is_active,
          started_at: sub.started_at,
          expires_at: sub.expires_at,
        }));
        setSubscriptions(formattedSubs);
        
        // Find free city from subscriptions
        const freeSub = formattedSubs.find(s => s.subscription_type === 'free');
        if (freeSub) setFreeCity(freeSub.city_name);
      } else {
        // Fallback: show city from professional's city_id if no subscriptions
        if (data.city_id?.name) {
          setFreeCity(data.city_id.name);
        } else if (data.cities_subscribed?.length > 0) {
          setFreeCity(data.cities_subscribed[0]);
        }
      }

      // Transform data
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
        ...(data.total_sales !== null && { total_sales: data.total_sales }),
        agent_sales_stats: data.agent_sales_stats as any,
        zillow_profile_url: data.zillow_profile_url || null,
        sidebar_video_url: data.sidebar_video_url || null,
        short_code: data.short_code,
      } as any;

      setProfessional(transformedProfessional);
    } finally {
      setLoading(false);
    }
  };

  // Realtime subscription so the dashboard auto-updates when this professional changes
  useEffect(() => {
    if (!professionalId) return;

    const channel = supabase
      .channel('professionals-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'professionals',
          filter: `id=eq.${professionalId}`,
        },
        (payload) => {
          // Use the same transformer so stats, yearsExperience, etc. update live
          loadProfileData(payload.new as any);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [professionalId]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success('Signed out successfully');
    navigate('/');
  };

  const handleManagePayment = async () => {
    setLoadingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        body: { professionalId }
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
        toast.error('Could not open payment portal');
      }
    } catch (error: any) {
      console.error('Error opening portal:', error);
      toast.error(error.message || 'Failed to open payment portal');
    } finally {
      setLoadingPortal(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      
      if (error) throw error;
      
      toast.success('Password updated successfully');
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error updating password:', error);
      toast.error(error.message || 'Failed to update password');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleEditProfile = () => {
    if (verificationToken) {
      navigate(`/profile/${verificationToken}/fields`);
    }
  };

  const handleUpgradePackage = () => {
    if (verificationToken) {
      navigate(`/profile/${verificationToken}/pricing`);
    }
  };

  const handleChangeFreeCity = () => {
    if (verificationToken) {
      navigate(`/profile/${verificationToken}/select-free-city`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background py-12">
        <div className="container mx-auto px-4 max-w-6xl">
          <Skeleton className="h-12 w-64 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
            <Skeleton className="h-96 w-full" />
          </div>
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
              <Button onClick={() => navigate('/')}>
                Return Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const paidCities = subscriptions.filter(s => s.subscription_type !== 'free' && s.is_active);

  return (
    <>
      <Helmet>
        <title>Agent Dashboard | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-8 md:py-12">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
            <div>
              {isAdminViewing && (
                <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded mb-2 inline-block">
                  Admin View: {professional.email}
                </div>
              )}
              <h1 className="text-2xl md:text-3xl font-bold">
                {isAdminViewing ? professional.name : `Welcome back, ${professional.name.split(' ')[0]}`}
              </h1>
              <p className="text-muted-foreground mt-1">
                {isAdminViewing ? 'Viewing agent dashboard' : 'Manage your Top10Lists profile and subscription'}
              </p>
            </div>
            <div className="flex gap-2">
              {isAdminViewing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/admin')}
                >
                  Back to Admin
                </Button>
              )}
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
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Actions & Subscriptions */}
            <div className="lg:col-span-2 space-y-6">
              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Button 
                      variant="outline" 
                      className="h-auto py-4 justify-start gap-3"
                      onClick={handleEditProfile}
                    >
                      <Edit className="h-5 w-5 text-primary" />
                      <div className="text-left">
                        <div className="font-medium">Edit Profile</div>
                        <div className="text-xs text-muted-foreground">Update your listing details</div>
                      </div>
                    </Button>

                    <Button 
                      variant="outline" 
                      className="h-auto py-4 justify-start gap-3"
                      onClick={handleManagePayment}
                      disabled={loadingPortal}
                    >
                      {loadingPortal ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <CreditCard className="h-5 w-5 text-primary" />
                      )}
                      <div className="text-left">
                        <div className="font-medium">Payment Method</div>
                        <div className="text-xs text-muted-foreground">Update billing information</div>
                      </div>
                    </Button>

                    <Button 
                      variant="outline" 
                      className="h-auto py-4 justify-start gap-3"
                      onClick={handleUpgradePackage}
                    >
                      <ArrowUpCircle className="h-5 w-5 text-primary" />
                      <div className="text-left">
                        <div className="font-medium">Upgrade Package</div>
                        <div className="text-xs text-muted-foreground">Add more cities</div>
                      </div>
                    </Button>

                    <Button 
                      variant="outline" 
                      className="h-auto py-4 justify-start gap-3"
                      onClick={() => setShowPasswordModal(true)}
                    >
                      <Lock className="h-5 w-5 text-primary" />
                      <div className="text-left">
                        <div className="font-medium">Change Password</div>
                        <div className="text-xs text-muted-foreground">Update your credentials</div>
                      </div>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* City Subscriptions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Your Cities
                  </CardTitle>
                  <CardDescription>
                    Cities where your listing appears
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Free City */}
                  {freeCity ? (
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                        <div>
                          <div className="font-medium">{freeCity}</div>
                          <div className="text-xs text-muted-foreground">Free Listing (Round-Robin)</div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={handleChangeFreeCity}>
                        Change
                      </Button>
                    </div>
                  ) : (
                    <div className="p-4 bg-muted/50 rounded-lg border space-y-3">
                      <div>
                        <div className="font-medium">Select Your Free City</div>
                        <div className="text-xs text-muted-foreground">Choose a city for your free round-robin listing</div>
                      </div>
                      <div className="flex gap-2">
                        <Select value={selectedFreeCityId} onValueChange={setSelectedFreeCityId}>
                          <SelectTrigger className="flex-1 bg-background">
                            <SelectValue placeholder="Select a city..." />
                          </SelectTrigger>
                          <SelectContent className="bg-background border z-50">
                            {availableCities.map(city => (
                              <SelectItem key={city.id} value={city.id}>
                                {city.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button 
                          onClick={handleSaveFreeCity} 
                          disabled={!selectedFreeCityId || savingFreeCity}
                        >
                          {savingFreeCity ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Paid Cities */}
                  {paidCities.length > 0 ? (
                    paidCities.map((sub) => (
                      <div 
                        key={sub.id} 
                        className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20"
                      >
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                          <div>
                            <div className="font-medium">{sub.city_name}</div>
                            <div className="text-xs text-muted-foreground">
                              Premium Placement • {sub.subscription_type === 'annual' ? 'Annual' : 'Monthly'}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs text-primary font-medium px-2 py-1 bg-primary/10 rounded">
                          Active
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <p className="mb-3">No premium city placements yet</p>
                      <Button size="sm" onClick={handleUpgradePackage}>
                        <ArrowUpCircle className="h-4 w-4 mr-2" />
                        Get Premium Placement
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Listing Preview */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Your Listing
                  </CardTitle>
                  <CardDescription>
                    How you appear on Top10Lists
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="scale-[0.85] origin-top -mb-16">
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
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Password Change Modal */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your new password below. Password must be at least 8 characters.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleChangePassword} disabled={updatingPassword}>
              {updatingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
