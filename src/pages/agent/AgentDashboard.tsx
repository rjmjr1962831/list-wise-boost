import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SafeHead } from "@/components/SafeHead";
import { supabase } from "@/integrations/supabase/client";
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
  Shield,
} from "lucide-react";
import { OverviewSection } from "@/components/agent/OverviewSection";
import { ProfileSection } from "@/components/agent/ProfileSection";
import { PayloadSection } from "@/components/agent/PayloadSection";
import { BillingSection } from "@/components/agent/BillingSection";
import { UpsellSection } from "@/components/agent/UpsellSection";
import { BadgeSection } from "@/components/agent/BadgeSection";
import { getValidImageUrl } from "@/utils/imageUrlValidator";
import { cn } from "@/lib/utils";

type NavSection = "overview" | "profile" | "payload" | "badge" | "upgrade" | "billing";

interface NavItem {
  id: NavSection;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "profile", label: "Profile", icon: User },
  { id: "payload", label: "Payload", icon: Bot },
  { id: "badge", label: "Badge", icon: Shield },
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
  const [searchParams, setSearchParams] = useSearchParams();
  const magicToken = searchParams.get("t");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [professional, setProfessional] = useState<any>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [hasStripeSubscription, setHasStripeSubscription] = useState(false);
  const [activeSection, setActiveSection] = useState<NavSection>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [authStatus, setAuthStatus] = useState("Loading...");
  const [certification, setCertification] = useState<any>(null);

  useEffect(() => {
    window.scrollTo(0, 0);

    if (magicToken) {
      // Magic link flow: create session from dashboard_token
      handleMagicToken(magicToken);
    } else {
      // Normal flow: validate existing session
      validateSessionAndLoad();
    }
  }, []);

  const handleMagicToken = async (dashboardToken: string) => {
    try {
      setAuthStatus("Verifying your link...");

      // Look up professional by dashboard_token
      const { data: prof, error: fetchErr } = await supabase
        .from("professionals")
        .select("id, name, verification_token, funnel_status, active")
        .eq("dashboard_token", dashboardToken)
        .maybeSingle();

      if (fetchErr || !prof) {
        setAuthStatus("Link not recognized. Please check your latest email.");
        setLoading(false);
        return;
      }

      if (!prof.active) {
        setAuthStatus("This profile is no longer active.");
        setLoading(false);
        return;
      }

      // Not approved? Send to funnel.
      if (prof.funnel_status !== "approved") {
        const funnelToken = prof.verification_token || prof.id;
        window.location.href = `/funnel/${funnelToken}`;
        return;
      }

      setAuthStatus(`Welcome back, ${prof.name.split(" ")[0]}!`);

      // Create session
      const { data: sessData, error: sessErr } =
        await supabase.functions.invoke("create-session-from-token", {
          body: { token: prof.id },
        });

      if (sessErr || !sessData?.success) {
        console.error("[Dashboard] Session create failed:", sessErr || sessData);
        setAuthStatus("Could not create session. Please try your link again.");
        setLoading(false);
        return;
      }

      // Store session and load profile
      localStorage.setItem("agent_session_token", sessData.sessionToken);
      setSessionToken(sessData.sessionToken);

      // Clean the URL (remove ?t= param)
      setSearchParams({}, { replace: true });

      await loadProfile(sessData.sessionToken);
    } catch (err) {
      console.error("[Dashboard] Magic token error:", err);
      setAuthStatus("Something went wrong. Please try your link again.");
      setLoading(false);
    }
  };

  const validateSessionAndLoad = async () => {
    const token = localStorage.getItem("agent_session_token");

    if (!token) {
      // No session. Don't send to login (agents may not have credentials).
      // Show a helpful message instead.
      setLoading(false);
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
        // Session expired - show the no-session state
        setLoading(false);
        return;
      }

      await loadProfile(token);
    } catch (error) {
      console.error("[AgentDashboard] Error:", error);
      localStorage.removeItem("agent_session_token");
      setLoading(false);
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
          setLoading(false);
          return;
        }
        toast.error("Failed to load profile");
        return;
      }

      setProfessional(data.professional);
      setSubscriptions(data.subscriptions || []);
      setPendingRequests(data.pendingRequests || []);
      setHasStripeSubscription(data.hasStripeSubscription || false);
      if (data.professional?.id) {
        const { data: cert } = await supabase
          .from("certifications")
          .select("certification_tier, certification_status, issued_at, last_verified_at, next_verification_due, markets_covered, neighborhoods_covered")
          .eq("professional_id", data.professional.id)
          .eq("certification_status", "active")
          .maybeSingle();
        setCertification(cert ?? null);
      }
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
    navigate("/");
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Skeleton className="h-8 w-8 rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">{authStatus}</p>
        </div>
      </div>
    );
  }

  if (!professional) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-md mx-auto p-8 border rounded-xl bg-card shadow-sm">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <User className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold mb-3">Dashboard Access</h1>
          <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
            {authStatus !== "Loading..." ? authStatus : "To access your dashboard, please use the link from your most recent Top10Lists email. Each link creates a secure session automatically."}
          </p>
          <div className="space-y-3">
            {magicToken && (
              <button
                onClick={() => handleMagicToken(magicToken)}
                className="w-full px-6 py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Try Again
              </button>
            )}
            <a
              href="mailto:support@top10lists.us?subject=Dashboard Access Help"
              className="block w-full px-6 py-3 border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
            >
              Contact Support
            </a>
            <a
              href="https://www.top10lists.us"
              className="block w-full px-6 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Go to Homepage
            </a>
          </div>
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

              {activeSection === "badge" && (
                <BadgeSection professional={professional} certification={certification} onRefresh={handleRefresh} />
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
