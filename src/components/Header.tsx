import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, User as UserIcon, Shield, LayoutDashboard, Menu, Bot } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Logo } from "@/components/brand/Logo";

/** Module-level so minifier cannot drop declaration and leave !isAdmin references broken. */
const IS_ADMIN = false;

interface AgentProfile {
  id: string;
  name: string;
  image_url: string | null;
  email?: string;
}

interface AgentSession {
  professional: AgentProfile;
  sessionToken: string;
}

/** EMERGENCY: Hard-coded to stop ReferenceError. Restore effectiveIsAdmin after production is stable. */
export const Header = () => {
  const [user, setUser] = useState<User | null>(null);
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
  const [agentSession, setAgentSession] = useState<AgentSession | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();

  // Check for custom agent session token (OTP-based login)
  const checkAgentSession = useCallback(async () => {
    const sessionToken = localStorage.getItem("agent_session_token");
    if (!sessionToken) {
      setAgentSession(null);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("validate-agent-session", {
        body: { sessionToken },
      });

      if (error || !data?.valid) {
        // Session expired or invalid - clear it
        console.log("Agent session invalid or expired, clearing...");
        localStorage.removeItem("agent_session_token");
        setAgentSession(null);
        return;
      }

      // Valid session - set the agent profile
      setAgentSession({
        professional: {
          id: data.professional.id,
          name: data.professional.name,
          image_url: data.professional.image_url,
          email: data.professional.email,
        },
        sessionToken,
      });
    } catch (err) {
      console.error("Error validating agent session:", err);
      localStorage.removeItem("agent_session_token");
      setAgentSession(null);
    }
  }, []);

  useEffect(() => {
    // Check for agent session token on mount
    checkAgentSession();

    // Listen for storage changes (e.g., login in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "agent_session_token") {
        checkAgentSession();
      }
    };
    window.addEventListener("storage", handleStorageChange);

    // Get initial Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchAgentProfile(session.user.email);
      }
    });

    // Listen for Supabase auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchAgentProfile(session.user.email);
      } else {
        setAgentProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [checkAgentSession]);

  // Re-check agent session periodically for expiry handling
  useEffect(() => {
    const interval = setInterval(() => {
      if (localStorage.getItem("agent_session_token")) {
        checkAgentSession();
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => clearInterval(interval);
  }, [checkAgentSession]);

  const fetchAgentProfile = async (email: string | undefined) => {
    if (!email) return;
    
    const { data } = await supabase
      .from('professionals')
      .select('id, name, image_url')
      .eq('email', email.toLowerCase())
      .eq('active', true)
      .maybeSingle();
    
    if (data) {
      setAgentProfile(data);
    }
  };

  const handleLogout = async () => {
    // Clear agent session (OTP-based)
    localStorage.removeItem("agent_session_token");
    setAgentSession(null);

    // Also sign out of Supabase Auth if applicable
    await supabase.auth.signOut();
    setAgentProfile(null);

    toast({
      title: "Logged out successfully",
    });
    navigate("/");
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Determine if user is logged in (either Supabase Auth or agent session)
  const isLoggedIn = !!(user || agentSession);
  
  // Get display profile (prefer agent session, fallback to Supabase auth profile)
  const displayProfile = agentSession?.professional || agentProfile;
  const displayEmail = agentSession?.professional?.email || user?.email;

  // Hide header on funnel pages
  if (location.pathname.startsWith('/funnel/')) return null;

  return (
    <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <Logo className="h-12" />
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/about" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              About
            </Link>
            <Link to="/about/ranking-methodology" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Methodology
            </Link>
            <Link to="/faq" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              FAQ
            </Link>
{IS_ADMIN && (
              <Link to="/admin" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                Admin
              </Link>
            )}
            <Link 
              to="/are-you-an-agent" 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Are you an agent?
            </Link>
            {isLoggedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 px-2">
                    <Avatar className="h-8 w-8">
                      {displayProfile?.image_url ? (
                        <AvatarImage 
                          src={displayProfile.image_url} 
                          alt={displayProfile.name || 'Profile'} 
                        />
                      ) : null}
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {displayProfile?.name ? getInitials(displayProfile.name) : <UserIcon className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <span className="max-w-[120px] truncate text-sm">
                      {displayProfile?.name?.split(' ')[0] || displayEmail?.split('@')[0]}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        {displayProfile?.image_url ? (
                          <AvatarImage 
                            src={displayProfile.image_url} 
                            alt={displayProfile.name || 'Profile'} 
                          />
                        ) : null}
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {displayProfile?.name ? getInitials(displayProfile.name) : <UserIcon className="h-5 w-5" />}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {displayProfile?.name || 'Account'}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground truncate">
                          {displayEmail}
                        </p>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {!IS_ADMIN && (
                    <>
                      <DropdownMenuItem onClick={() => navigate("/agent/dashboard")}>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        My Dashboard
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/agent/bot-analytics")}>
                        <Bot className="mr-2 h-4 w-4" />
                        Bot Analytics
                      </DropdownMenuItem>
                    </>
                  )}
                  {IS_ADMIN && (
                    <DropdownMenuItem onClick={() => navigate("/admin")}>
                      Admin Dashboard
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link to="/agent/login">
                <Button variant="outline" size="sm">
                  Login
                </Button>
              </Link>
            )}
          </nav>

          {/* Mobile Navigation */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] sm:w-[320px]">
              <SheetHeader>
                <SheetTitle className="text-left">Menu</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-4 mt-6">
                <SheetClose asChild>
                  <Link 
                    to="/about" 
                    className="text-base font-medium text-foreground hover:text-primary transition-colors py-2"
                  >
                    About
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link 
                    to="/about/ranking-methodology" 
                    className="text-base font-medium text-foreground hover:text-primary transition-colors py-2"
                  >
                    Methodology
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link 
                    to="/faq" 
                    className="text-base font-medium text-foreground hover:text-primary transition-colors py-2"
                  >
                    FAQ
                  </Link>
                </SheetClose>
                {IS_ADMIN && (
                  <SheetClose asChild>
                    <Link 
                      to="/admin" 
                      className="text-base font-medium text-primary hover:text-primary/80 transition-colors py-2"
                    >
                      Admin
                    </Link>
                  </SheetClose>
                )}
                <SheetClose asChild>
                  <Link 
                    to="/are-you-an-agent" 
                    className="text-base font-medium text-foreground hover:text-primary transition-colors py-2"
                  >
                    Are you an agent?
                  </Link>
                </SheetClose>
                
                <div className="border-t pt-4 mt-2">
                  {isLoggedIn ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3 pb-3">
                        <Avatar className="h-10 w-10">
                          {displayProfile?.image_url ? (
                            <AvatarImage 
                              src={displayProfile.image_url} 
                              alt={displayProfile.name || 'Profile'} 
                            />
                          ) : null}
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {displayProfile?.name ? getInitials(displayProfile.name) : <UserIcon className="h-5 w-5" />}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <p className="text-sm font-medium">
                            {displayProfile?.name || 'Account'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {displayEmail}
                          </p>
                        </div>
                      </div>
                      {!IS_ADMIN && (
                        <SheetClose asChild>
                          <Button 
                            variant="outline" 
                            className="justify-start" 
                            onClick={() => navigate("/agent/dashboard")}
                          >
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            My Dashboard
                          </Button>
                        </SheetClose>
                      )}
                      {IS_ADMIN && (
                        <SheetClose asChild>
                          <Button 
                            variant="outline" 
                            className="justify-start" 
                          >
                            Admin Dashboard
                          </Button>
                        </SheetClose>
                      )}
                      <SheetClose asChild>
                        <Button 
                          variant="destructive" 
                          className="justify-start" 
                          onClick={handleLogout}
                        >
                          <LogOut className="mr-2 h-4 w-4" />
                          Logout
                        </Button>
                      </SheetClose>
                    </div>
                  ) : (
                    <SheetClose asChild>
                      <Link to="/agent/login">
                        <Button className="w-full">
                          Login
                        </Button>
                      </Link>
                    </SheetClose>
                  )}
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};
