import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Building2, Tag, Users, FileText, Home, Wand2, FlaskConical, MapPin } from "lucide-react";
import { toast } from "sonner";
import CitiesManager from "@/components/admin/CitiesManager";
import CategoriesManager from "@/components/admin/CategoriesManager";
import ProfessionalsManager from "@/components/admin/ProfessionalsManager";
import { MarketingContentManager } from "@/components/admin/MarketingContentManager";
import { ZillowAgentImporter } from "@/components/admin/ZillowAgentImporter";
import { ZipCodeManager } from "@/components/admin/ZipCodeManager";
import { BioGenerator } from "@/components/admin/BioGenerator";
import { LicenseLookupTester } from "@/components/admin/LicenseLookupTester";

const AdminDashboard = () => {
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
        toast.error("You don't have admin access");
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
          <p className="text-muted-foreground">Loading admin panel...</p>
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
            <h1 className="text-4xl font-bold">CMS Admin Panel</h1>
            <p className="text-muted-foreground mt-2">Manage cities, categories, and professionals</p>
          </div>
          <Button onClick={handleLogout} variant="outline">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>

        <Tabs defaultValue="cities" className="space-y-6">
          <TabsList className="grid w-full grid-cols-8 max-w-6xl">
            <TabsTrigger value="cities">
              <Building2 className="mr-2 h-4 w-4" />
              Cities
            </TabsTrigger>
            <TabsTrigger value="categories">
              <Tag className="mr-2 h-4 w-4" />
              Categories
            </TabsTrigger>
            <TabsTrigger value="professionals">
              <Users className="mr-2 h-4 w-4" />
              Professionals
            </TabsTrigger>
            <TabsTrigger value="marketing">
              <FileText className="mr-2 h-4 w-4" />
              Marketing
            </TabsTrigger>
            <TabsTrigger value="zillow">
              <Home className="mr-2 h-4 w-4" />
              Zillow
            </TabsTrigger>
            <TabsTrigger value="zip-codes">
              <MapPin className="mr-2 h-4 w-4" />
              Zip Codes
            </TabsTrigger>
            <TabsTrigger value="bio-generator">
              <Wand2 className="mr-2 h-4 w-4" />
              AI Bios
            </TabsTrigger>
            <TabsTrigger value="license-tester">
              <FlaskConical className="mr-2 h-4 w-4" />
              Test License
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cities" className="space-y-4">
            <CitiesManager />
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <CategoriesManager />
          </TabsContent>

          <TabsContent value="professionals" className="space-y-4">
            <ProfessionalsManager />
          </TabsContent>

          <TabsContent value="marketing" className="space-y-4">
            <MarketingContentManager />
          </TabsContent>

          <TabsContent value="zillow" className="space-y-4">
            <ZillowAgentImporter />
          </TabsContent>

          <TabsContent value="zip-codes" className="space-y-4">
            <ZipCodeManager />
          </TabsContent>

          <TabsContent value="bio-generator" className="space-y-4">
            <BioGenerator />
          </TabsContent>

          <TabsContent value="license-tester" className="space-y-4">
            <LicenseLookupTester />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;