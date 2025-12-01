import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Users, Database, Zap, Briefcase, Download } from "lucide-react";
import { toast } from "sonner";
import { CRMExportGenerator } from "@/components/admin/CRMExportGenerator";
import { ContactEnrichmentQueue } from "@/components/admin/ContactEnrichmentQueue";
import { EnrichmentProgressDashboard } from "@/components/admin/EnrichmentProgressDashboard";
import { RealtimeEnrichmentDashboard } from "@/components/admin/RealtimeEnrichmentDashboard";
import FullEnrichmentPipeline from "@/components/admin/FullEnrichmentPipeline";
import { EnrichmentResultsDashboard } from "@/components/admin/EnrichmentResultsDashboard";
import { StopEnrichmentButton } from "@/components/admin/StopEnrichmentButton";
import { EnrichmentCostControls } from "@/components/admin/EnrichmentCostControls";
import { EnrichmentPipelineStatus } from "@/components/admin/EnrichmentPipelineStatus";
import { AdminHubSpotSync } from "@/components/admin/AdminHubSpotSync";
import { AdminProspectsManager } from "@/components/admin/AdminProspectsManager";
import AdminPipedriveSync from "@/components/admin/AdminPipedriveSync";
import AdminPipedriveFields from "@/components/admin/AdminPipedriveFields";
import { AdminPipedriveAutoSync } from "@/components/admin/AdminPipedriveAutoSync";
import { QueuedEmailVerifier } from '@/components/admin/QueuedEmailVerifier';
import { EmailVerificationBackfill } from '@/components/admin/EmailVerificationBackfill';
import { BulkEmailVerifier } from '@/components/admin/BulkEmailVerifier';
import { MagicLinkGenerator } from '@/components/admin/MagicLinkGenerator';
import { BulkProfileSynthesizer } from '@/components/admin/BulkProfileSynthesizer';
import BulkPressEnricher from '@/components/admin/BulkPressEnricher';

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
          <div className="flex gap-2">
            <Button onClick={() => navigate("/crm")} variant="outline">
              <Briefcase className="mr-2 h-4 w-4" />
              CRM
            </Button>
            <Button onClick={handleLogout} variant="outline">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        <div className="mb-6 p-4 bg-card rounded-lg border">
          <h2 className="text-lg font-semibold mb-2">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <StopEnrichmentButton />
            <EnrichmentCostControls />
          </div>
          <h2 className="text-lg font-semibold mb-2 mt-4">Download Files</h2>
          <div className="flex gap-2">
            <a 
              href="/newly-added-cities-enriched.csv" 
              download="newly-added-cities-enriched.csv"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
            >
              Download Cities CSV
            </a>
            <a 
              href="/qualified-agents-crm.csv" 
              download="qualified-agents-crm.csv"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
            >
              Download CRM Export (129 Agents)
            </a>
          </div>
        </div>

        <Tabs defaultValue="prospects" className="space-y-6">
          <TabsList className="inline-flex w-full max-w-7xl h-auto flex-wrap gap-1 p-2">
            <TabsTrigger value="prospects">
              <Users className="mr-2 h-4 w-4" />
              Prospects
            </TabsTrigger>
            <TabsTrigger value="hubspot-sync">
              <Database className="mr-2 h-4 w-4" />
              HubSpot Sync
            </TabsTrigger>
            <TabsTrigger value="crm-export">
              <Download className="mr-2 h-4 w-4" />
              CRM Export
            </TabsTrigger>
            <TabsTrigger value="pipedrive-sync">
              <Database className="mr-2 h-4 w-4" />
              Pipedrive Sync
            </TabsTrigger>
            <TabsTrigger value="pipedrive-fields">
              <Database className="mr-2 h-4 w-4" />
              Pipedrive Fields
            </TabsTrigger>
            <TabsTrigger value="enrichment-progress">
              <Zap className="mr-2 h-4 w-4" />
              Enrichment Progress
            </TabsTrigger>
            <TabsTrigger value="enrichment-queue">
              <Zap className="mr-2 h-4 w-4" />
              Enrichment Queue
            </TabsTrigger>
            <TabsTrigger value="realtime-enrichment">
              <Zap className="mr-2 h-4 w-4" />
              Realtime Pipeline
            </TabsTrigger>
            <TabsTrigger value="full-enrichment">
              <Zap className="mr-2 h-4 w-4" />
              Full Enrichment
            </TabsTrigger>
            <TabsTrigger value="results-dashboard">
              <Zap className="mr-2 h-4 w-4" />
              Results Dashboard
            </TabsTrigger>
            <TabsTrigger value="pipeline-status">
              <Zap className="mr-2 h-4 w-4" />
              Pipeline Status
            </TabsTrigger>
            <TabsTrigger value="email-verification">
              <Database className="mr-2 h-4 w-4" />
              Email Verification
            </TabsTrigger>
            <TabsTrigger value="magic-links">
              <Database className="mr-2 h-4 w-4" />
              Magic Links
            </TabsTrigger>
            <TabsTrigger value="bulk-synthesis">
              <Zap className="mr-2 h-4 w-4" />
              Profile Synthesis
            </TabsTrigger>
            <TabsTrigger value="bulk-press">
              <Zap className="mr-2 h-4 w-4" />
              Bulk Press Enrichment
            </TabsTrigger>
          </TabsList>

          <TabsContent value="prospects" className="space-y-4">
            <AdminProspectsManager />
          </TabsContent>

          <TabsContent value="hubspot-sync" className="space-y-4">
            <AdminHubSpotSync />
          </TabsContent>

          <TabsContent value="crm-export" className="space-y-4">
            <CRMExportGenerator />
          </TabsContent>

          <TabsContent value="pipedrive-sync" className="space-y-4">
            <AdminPipedriveAutoSync />
            <AdminPipedriveSync />
          </TabsContent>

          <TabsContent value="pipedrive-fields" className="space-y-4">
            <AdminPipedriveFields />
          </TabsContent>

          <TabsContent value="enrichment-progress" className="space-y-4">
            <EnrichmentProgressDashboard />
          </TabsContent>

          <TabsContent value="enrichment-queue" className="space-y-4">
            <ContactEnrichmentQueue />
          </TabsContent>

          <TabsContent value="realtime-enrichment" className="space-y-4">
            <RealtimeEnrichmentDashboard />
          </TabsContent>

          <TabsContent value="full-enrichment" className="space-y-4">
            <FullEnrichmentPipeline />
          </TabsContent>

          <TabsContent value="results-dashboard" className="space-y-4">
            <EnrichmentResultsDashboard />
          </TabsContent>

          <TabsContent value="pipeline-status" className="space-y-4">
            <EnrichmentPipelineStatus />
          </TabsContent>

          <TabsContent value="email-verification" className="space-y-4">
            <EmailVerificationBackfill />
            <QueuedEmailVerifier />
            <BulkEmailVerifier />
          </TabsContent>

          <TabsContent value="magic-links" className="space-y-4">
            <MagicLinkGenerator />
          </TabsContent>

          <TabsContent value="bulk-synthesis" className="space-y-4">
            <BulkProfileSynthesizer />
          </TabsContent>

          <TabsContent value="bulk-press" className="space-y-4">
            <BulkPressEnricher />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;