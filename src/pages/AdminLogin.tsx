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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Sign in with password
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (signInError) throw signInError;
      
      if (!authData.user) {
        throw new Error("No user data returned");
      }
      
      console.log("[AdminLogin] User signed in:", authData.user.id);
      
      // Check if user has admin role
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authData.user.id);
      
      console.log("[AdminLogin] User roles:", roles);
      
      if (rolesError) {
        console.error("[AdminLogin] Error fetching roles:", rolesError);
        throw new Error("Failed to check admin access");
      }
      
      if (!roles || !roles.some(r => r.role === "admin")) {
        await supabase.auth.signOut();
        throw new Error("You don't have admin access");
      }
      
      toast.success("Welcome back!");
      navigate("/admin");
    } catch (error: any) {
      console.error("[AdminLogin] Error:", error);
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
          <form onSubmit={handleAuth} className="space-y-4">
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
            <Button type="submit" className="w-full" disabled={isLoading}>
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