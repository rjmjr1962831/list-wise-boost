import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { LogOut, User, CreditCard, TrendingUp, RefreshCw } from "lucide-react";
import { ProfileSection } from "@/components/agent/ProfileSection";
import { BillingSection } from "@/components/agent/BillingSection";
import { UpsellSection } from "@/components/agent/UpsellSection";
import { getValidImageUrl } from "@/utils/imageUrlValidator";

interface Subscription {
  id: string;
  subscription_type: string;
  is_active: boolean;
  started_at: string | null;
  expires_at: string | null;
  stripe_subscription_id: string | null;
  city: {
    id: string;
    city_name: string;
    city_slug: string;
  } | null;
}

interface PendingRequest {
  id: string;
  field_name: string;
  current_value: string | null;
  proposed_value: string | null;
  status: string;
  created_at: string;
}

export default function AgentDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [professional, setProfessional] = useState<any>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [hasStripeSubscription, setHasStripeSubscription] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    validateSessionAndLoad();
  }, []);

  const validateSessionAndLoad = async () => {
    const token = localStorage.getItem("agent_session_token");

    if (!token) {
      console.log("[AgentDashboard] No session token found, redirecting to login");
      navigate("/agent/login");
      return;
    }

    setSessionToken(token);

    try {
      // Validate session
      const { data: sessionData, error: sessionError } = await supabase.functions.invoke(
        "validate-agent-session",
        { body: { sessionToken: token } }
      );

      if (sessionError || !sessionData?.valid) {
        console.log("[AgentDashboard] Session invalid, clearing and redirecting");
        localStorage.removeItem("agent_session_token");
        navigate("/agent/login");
        return;
      }

      // Fetch full profile
      await loadProfile(token);
    } catch (error) {
      console.error("[AgentDashboard] Error validating session:", error);
      localStorage.removeItem("agent_session_token");
      navigate("/agent/login");
    }
  };

  const loadProfile = async (token: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("get-agent-profile", {
        body: { sessionToken: token },
      });

      if (error) {
        console.error("[AgentDashboard] Error loading profile:", error);
        if (error.message?.includes("401") || error.message?.includes("expired")) {
          localStorage.removeItem("agent_session_token");
          navigate("/agent/login");
          return;
        }
        toast.error("Failed to load profile");
        return;
      }

      setProfessional(data.professional);
      setSubscriptions(data.subscriptions || []);
      setPendingRequests(data.pendingRequests || []);
      setHasStripeSubscription(data.hasStripeSubscription || false);
    } catch (error) {
      console.error("[AgentDashboard] Error:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    if (!sessionToken) return;
    setRefreshing(true);
    loadProfile(sessionToken);
  };

  const handleLogout = () => {
    localStorage.removeItem("agent_session_token");
    toast.success("Signed out successfully");
    navigate("/agent/login");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background py-12">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-center gap-4 mb-8">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-12 w-full max-w-md mb-6" />
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
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
              <p className="text-muted-foreground mb-4">
                Could not load your profile. Please try logging in again.
              </p>
              <Button onClick={() => navigate("/agent/login")}>Go to Login</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const activeSubscriptionCount = subscriptions.filter((s) => s.is_active).length;

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
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-primary/20">
                <AvatarImage src={getValidImageUrl(professional.image_url)} alt={professional.name} />
                <AvatarFallback className="bg-primary/10 text-primary text-lg">
                  {getInitials(professional.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">
                  Welcome back, {professional.name.split(" ")[0]}
                </h1>
                <p className="text-muted-foreground">
                  {professional.city?.name && `${professional.city.name}, ${professional.city.state}`}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Profile</span>
              </TabsTrigger>
              <TabsTrigger value="billing" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                <span className="hidden sm:inline">Billing</span>
              </TabsTrigger>
              <TabsTrigger value="upgrade" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">Upgrade</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <ProfileSection
                professional={professional}
                sessionToken={sessionToken!}
                pendingRequests={pendingRequests}
                onProfileUpdate={handleRefresh}
              />
            </TabsContent>

            <TabsContent value="billing">
              <BillingSection
                professional={professional}
                subscriptions={subscriptions}
                hasStripeSubscription={hasStripeSubscription}
              />
            </TabsContent>

            <TabsContent value="upgrade">
              <UpsellSection
                professional={professional}
                subscriptionCount={activeSubscriptionCount}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}
