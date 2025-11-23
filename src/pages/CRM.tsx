import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Users, UserPlus, CheckSquare, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { LeadsManager } from "@/components/crm/LeadsManager";
import { FollowUpsManager } from "@/components/crm/FollowUpsManager";
import { CRMDashboard } from "@/components/crm/CRMDashboard";

const CRM = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/admin/login");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (!roles || !roles.some(r => r.role === "admin")) {
        toast.error("You don't have access to CRM");
        navigate("/");
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      console.error("Error checking admin access:", error);
      navigate("/admin/login");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/admin/login");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading CRM...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold">CRM Dashboard</h1>
            <p className="text-muted-foreground mt-2">Manage contacts, leads, and follow-ups</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/admin")} variant="outline">
              Back to Admin
            </Button>
            <Button onClick={handleLogout} variant="outline">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="inline-flex w-full max-w-2xl">
            <TabsTrigger value="overview" className="flex-1">
              <BarChart3 className="mr-2 h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="leads" className="flex-1">
              <UserPlus className="mr-2 h-4 w-4" />
              Leads
            </TabsTrigger>
            <TabsTrigger value="followups" className="flex-1">
              <CheckSquare className="mr-2 h-4 w-4" />
              Follow-ups
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <CRMDashboard />
          </TabsContent>

          <TabsContent value="leads">
            <LeadsManager />
          </TabsContent>

          <TabsContent value="followups">
            <FollowUpsManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CRM;
