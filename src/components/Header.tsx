import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, User as UserIcon, Shield, LayoutDashboard } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Logo } from "@/components/brand/Logo";

interface AgentProfile {
  id: string;
  name: string;
  image_url: string | null;
}

export const Header = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
  
  const navigate = useNavigate();


  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminStatus(session.user.id);
        fetchAgentProfile(session.user.email);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminStatus(session.user.id);
        fetchAgentProfile(session.user.email);
      } else {
        setIsAdmin(false);
        setAgentProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminStatus = async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .single();
    
    setIsAdmin(!!data);
  };

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

  return (
    <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <Logo className="h-12" />
          </Link>
          
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
            <Link to="/compare" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Compare Us
            </Link>
            <Link to="/test" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Test Us
            </Link>
            {isAdmin && (
              <Link to="/admin" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                Admin
              </Link>
            )}
            {!user && (
              <Link 
                to="/are-you-an-agent" 
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                Are you an agent?
              </Link>
            )}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 px-2">
                    <Avatar className="h-8 w-8">
                      {agentProfile?.image_url ? (
                        <AvatarImage 
                          src={agentProfile.image_url} 
                          alt={agentProfile.name || 'Profile'} 
                        />
                      ) : null}
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {agentProfile?.name ? getInitials(agentProfile.name) : <UserIcon className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <span className="max-w-[120px] truncate text-sm">
                      {agentProfile?.name?.split(' ')[0] || user.email?.split('@')[0]}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        {agentProfile?.image_url ? (
                          <AvatarImage 
                            src={agentProfile.image_url} 
                            alt={agentProfile.name || 'Profile'} 
                          />
                        ) : null}
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {agentProfile?.name ? getInitials(agentProfile.name) : <UserIcon className="h-5 w-5" />}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {agentProfile?.name || 'Account'}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground truncate">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {!isAdmin && (
                    <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      My Dashboard
                    </DropdownMenuItem>
                  )}
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => navigate("/admin")}>
                      <Shield className="mr-2 h-4 w-4" />
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
              <Link to="/agent-login">
                <Button variant="outline" size="sm">
                  Login
                </Button>
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};