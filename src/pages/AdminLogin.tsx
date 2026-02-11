import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Shield } from "lucide-react";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  
  const handleAuth = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }
    
    setIsLoading(true);

    try {
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });
      
      if (signInError) {
        throw signInError;
      }
      
      if (!authData?.user) {
        throw new Error("No user data returned");
      }
      
      const { data: roles, error: rolesError } = await supabase
        .from("admin_users")
        .select("role")
        .eq("id", authData.user.id);
      
      if (rolesError) {
        throw new Error(`Failed to check admin access: ${rolesError.message}`);
      }
      
      if (!roles || roles.length === 0) {
        await supabase.auth.signOut();
        throw new Error("No roles found for this user");
      }
      
      const hasAdminRole = roles.some(r => r.role === "admin");
      if (!hasAdminRole) {
        await supabase.auth.signOut();
        throw new Error("You don't have admin access");
      }
      
      toast.success("Welcome back!");
      navigate("/admin");
    } catch (error: any) {
      toast.error(error.message || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Admin Login | Top10Lists.us</title>
        <meta name="description" content="Admin login portal for Top10Lists.us management dashboard." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
        <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <h1 className="sr-only">Admin Login - Top10Lists.us</h1>
          <div className="flex justify-center mb-4">
            <Shield className="h-12 w-12 text-primary" />
          </div>
          <CardTitle>Admin Access</CardTitle>
          <CardDescription>
            Sign in to manage your content
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => { e.preventDefault(); void handleAuth(); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleAuth(); } }}
            noValidate
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button 
              type="button"
              className="w-full" 
              disabled={isLoading}
              onClick={() => void handleAuth()}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
        </Card>
      </div>
    </>
  );
};

export default AdminLogin;