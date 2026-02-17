import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SafeHead } from "@/components/SafeHead";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  LogOut,
  LayoutDashboard,
  User,
  Bot,
  TrendingUp,
  CreditCard,
  RefreshCw,
  Menu,
  X,
} from "lucide-react";
import { OverviewSection } from "@/components/agent/OverviewSection";
import { ProfileSection } from "@/components/agent/ProfileSection";
import { PayloadSection } from "@/components/agent/PayloadSection";
import { BillingSection } from "@/components/agent/BillingSection";
import { getValidImageUrl } from "@/utils/imageUrlValidator";
import { cn } from "@/lib/utils";

type NavSection = "overview" | "profile" | "payload" | "upgrade" | "billing";

interface NavItem {
  id: NavSection;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "profile", label: "Profile", icon: User },
  { id: "payload", label: "Payload", icon: Bot },
  { id: "upgrade", label: "Upgrade", icon: TrendingUp },
  { id: "billing", label: "Billing", icon: CreditCard },
];

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
  const [activeSection, setActiveSection] = useState<NavSection>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    validateSessionAndLoad();
  }, []);

  const validateSessionAndLoad = async () => {
    const token = localStorage.getItem("agent_session_token");

    if (!token) {
      navigate("/agent/login");
      return;
    }

    setSessionToken(token);

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.functions.invoke("validate-agent-session", {
          body: { sessionToken: token },
        });

      if (sessionError || !sessionData?.valid) {
        localStorage.removeItem("agent_session_token");
        navigate("/agent/login");
        return;
      }

      await loadProfile(token);
    } catch (error) {
      console.error("[AgentDashboard] Error:", error);
      localStorage.removeItem("agent_session_token");
      navigate("/agent/login");
    }
  };

  const loadProfile = async (token: string) => {
    try {
      const { data, error } = await supabase.functions.invoke(
        "get-agent-profile",
        { body: { sessionToken: token } }
      );

      if (error) {
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

  const handleNavClick = (section: NavSection) => {
    if (section === "upgrade") {
      if (professional?.id) {
        sessionStorage.setItem("visibility_professional_id", professional.id);
      }
      const verificationToken =
        professional?.verification_token || professional?.id;
      if (verificationToken) {
        sessionStorage.setItem(
          "visibility_professional_token",
          verificationToken
        );
      }
      navigate("/visibility/expertise");
      return;
    }
    setActiveSection(section);
    setMobileNavOpen(false);
    window.scrollTo(0, 0);
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);

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
          <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
            <Skeleton className="h-64 hidden lg:block" />
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
              <Button onClick={() => navigate("/agent/login")}>
                Go to Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
      <SafeHead>
        <title>Agent Dashboard | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
      </SafeHead>

      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        {/* Top Bar */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30">
          <div className="container mx-auto px-4 max-w-7xl">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                {/* Mobile menu toggle */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setMobileNavOpen(!mobileNavOpen)}
                >
                  {mobileNavOpen ? (
                    <X className="h-5 w-5" />
                  ) : (
                    <Menu className="h-5 w-5" />
                  )}
                </Button>
                <Avatar className="h-10 w-10 border border-primary/20">
                  <AvatarImage
                    src={getValidImageUrl(professional?.image_url)}
                    alt={professional?.name ?? "Agent"}
                  />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {getInitials(professional?.name ?? "Agent")}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block">
                  <p className="text-sm font-semibold leading-none">
                    {professional?.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {professional?.city?.name && professional?.city?.state
                      ? `${professional.city.name}, ${professional.city.state}`
                      : professional?.business_city ?? ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  <RefreshCw
                    className={cn("h-4 w-4", refreshing && "animate-spin")}
                  />
                  <span className="hidden sm:inline ml-2">Refresh</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline ml-2">Sign Out</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 max-w-7xl py-6">
          <div className="flex gap-6">
            {/* Sidebar (desktop) */}
            <aside className="hidden lg:block w-[220px] shrink-0">
              <nav className="sticky top-24 space-y-1">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
                      activeSection === item.id
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </button>
                ))}
              </nav>
            </aside>

            {/* Mobile Nav Drawer */}
            {mobileNavOpen && (
              <div className="fixed inset-0 z-40 lg:hidden">
                <div
                  className="absolute inset-0 bg-black/40"
                  onClick={() => setMobileNavOpen(false)}
                />
                <div className="absolute left-0 top-16 bottom-0 w-64 bg-background border-r p-4 space-y-1">
                  {NAV_ITEMS.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
                        activeSection === item.id
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Main Content */}
            <main className="flex-1 min-w-0">
              {activeSection === "overview" && (
                <OverviewSection professional={professional} />
              )}

              {activeSection === "profile" && (
                <ProfileSection
                  professional={professional}
                  sessionToken={sessionToken!}
                  pendingRequests={pendingRequests}
                  onProfileUpdate={handleRefresh}
                />
              )}

              {activeSection === "payload" && (
                <PayloadSection professional={professional} />
              )}

              {activeSection === "billing" && (
                <BillingSection
                  professional={professional}
                  subscriptions={subscriptions}
                  hasStripeSubscription={hasStripeSubscription}
                />
              )}
            </main>
          </div>
        </div>
      </div>
    </>
  );
}
