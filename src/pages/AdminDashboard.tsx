import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Tag, Users, FileText, Home, Wand2, FlaskConical, MapPin, UserPlus, Link2, Database, Bug, Zap, TrendingUp, Briefcase, Download } from "lucide-react";
import { toast } from "sonner";
import CategoriesManager from "@/components/admin/CategoriesManager";
import ProfessionalsManager from "@/components/admin/ProfessionalsManager";
import { MarketingContentManager } from "@/components/admin/MarketingContentManager";
import { ZillowAgentImporter } from "@/components/admin/ZillowAgentImporter";
import { AgenScrapeImporter } from "@/components/admin/AgenScrapeImporter";
import { PhotoGenerator } from "@/components/admin/PhotoGenerator";
import { ZipCodeManager } from "@/components/admin/ZipCodeManager";
import { ZipCodeDataConverter } from "@/components/admin/ZipCodeDataConverter";
import { BioGenerator } from "@/components/admin/BioGenerator";
import { LicenseLookupTester } from "@/components/admin/LicenseLookupTester";
import { ManualAgentAdder } from "@/components/admin/ManualAgentAdder";
import { ZuidExtractor } from "@/components/admin/ZuidExtractor";
import { BeauvaisEnricher } from "@/components/admin/BeauvaisEnricher";
import { AgentApplicationsManager } from "@/components/admin/AgentApplicationsManager";
import { AgentStatsImporter } from "@/components/admin/AgentStatsImporter";
import { ArizonaLicenseImporter } from "@/components/admin/ArizonaLicenseImporter";
import { BulkStatsFetcher } from "@/components/admin/BulkStatsFetcher";
import { ZillowScraperDebug } from "@/components/admin/ZillowScraperDebug";
import { SingleAgentMemo23 } from "@/components/admin/SingleAgentMemo23";
import { BackfillScottsdaleRatings } from "@/components/admin/BackfillScottsdaleRatings";
import { BulkMemo23Enricher } from "@/components/admin/BulkMemo23Enricher";
import { BulkPhoenixImporter } from "@/components/admin/BulkPhoenixImporter";
import { PhoenixMemo23Workflow } from "@/components/admin/PhoenixMemo23Workflow";
import { ScottsdaleEnricher } from "@/components/admin/ScottsdaleEnricher";
import { PhoenixEnricher } from "@/components/admin/PhoenixEnricher";
import { EnrichmentProgressDashboard } from "@/components/admin/EnrichmentProgressDashboard";
import { ProxyHealthDashboard } from "@/components/admin/ProxyHealthDashboard";
import { ReplicateAgentPhoenix } from "@/components/admin/ReplicateAgentPhoenix";
import { TestProxyEnrichment } from "@/components/admin/TestProxyEnrichment";
import CitiesManager from "@/components/admin/CitiesManager";
import { BulkEmailUpdater } from "@/components/admin/BulkEmailUpdater";
import { AgentDeduplicator } from "@/components/admin/AgentDeduplicator";
import { PhoneNumberRestorer } from "@/components/admin/PhoneNumberRestorer";
import { VerificationLinkGenerator } from "@/components/admin/VerificationLinkGenerator";
import { CRMExportGenerator } from "@/components/admin/CRMExportGenerator";
import { ContactEnrichmentQueue } from "@/components/admin/ContactEnrichmentQueue";

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
          <h2 className="text-lg font-semibold mb-2">Download Files</h2>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <a href="/newly-added-cities-enriched.csv" download="newly-added-cities-enriched.csv">
                Download Cities CSV
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href="/qualified-agents-crm.csv" download="qualified-agents-crm.csv">
                Download CRM Export (129 Agents)
              </a>
            </Button>
          </div>
        </div>

        <Tabs defaultValue="categories" className="space-y-6">
          <TabsList className="inline-flex w-full max-w-7xl h-auto flex-wrap gap-1 p-2">
            <TabsTrigger value="categories">
              <Tag className="mr-2 h-4 w-4" />
              Categories
            </TabsTrigger>
            <TabsTrigger value="professionals">
              <Users className="mr-2 h-4 w-4" />
              Professionals
            </TabsTrigger>
            <TabsTrigger value="applications">
              <UserPlus className="mr-2 h-4 w-4" />
              Applications
            </TabsTrigger>
            <TabsTrigger value="add-agent">
              <UserPlus className="mr-2 h-4 w-4" />
              Add Agent
            </TabsTrigger>
            <TabsTrigger value="marketing">
              <FileText className="mr-2 h-4 w-4" />
              Marketing
            </TabsTrigger>
            <TabsTrigger value="zillow">
              <Home className="mr-2 h-4 w-4" />
              Zillow
            </TabsTrigger>
            <TabsTrigger value="agenscrape">
              <Database className="mr-2 h-4 w-4" />
              AgenScrape
            </TabsTrigger>
            <TabsTrigger value="photos">
              <Wand2 className="mr-2 h-4 w-4" />
              AI Photos
            </TabsTrigger>
            <TabsTrigger value="zip-codes">
              <MapPin className="mr-2 h-4 w-4" />
              Zip Codes
            </TabsTrigger>
            <TabsTrigger value="bio-generator">
              <Wand2 className="mr-2 h-4 w-4" />
              AI Bios
            </TabsTrigger>
            <TabsTrigger value="zuid-extractor">
              <Link2 className="mr-2 h-4 w-4" />
              ZUID
            </TabsTrigger>
            <TabsTrigger value="license-tester">
              <FlaskConical className="mr-2 h-4 w-4" />
              Test License
            </TabsTrigger>
            <TabsTrigger value="az-licenses">
              <FlaskConical className="mr-2 h-4 w-4" />
              AZ Licenses
            </TabsTrigger>
            <TabsTrigger value="import-stats">
              <Database className="mr-2 h-4 w-4" />
              Import Stats
            </TabsTrigger>
            <TabsTrigger value="scraper-debug">
              <Bug className="mr-2 h-4 w-4" />
              Debug
            </TabsTrigger>
            <TabsTrigger value="bulk-enrich">
              <Database className="mr-2 h-4 w-4" />
              Bulk Enrich
            </TabsTrigger>
            <TabsTrigger value="bulk-phoenix">
              <Zap className="mr-2 h-4 w-4" />
              Bulk Phoenix
            </TabsTrigger>
            <TabsTrigger value="phoenix-memo23">
              <Zap className="mr-2 h-4 w-4" />
              Phoenix Memo23
            </TabsTrigger>
            <TabsTrigger value="progress-dashboard">
              <TrendingUp className="mr-2 h-4 w-4" />
              Progress Dashboard
            </TabsTrigger>
            <TabsTrigger value="proxy-health">
              <Database className="mr-2 h-4 w-4" />
              Proxy Health
            </TabsTrigger>
            <TabsTrigger value="backfill">
              <Zap className="mr-2 h-4 w-4" />
              Backfill Ratings
            </TabsTrigger>
            <TabsTrigger value="email-updater">
              <Database className="mr-2 h-4 w-4" />
              Email Updater
            </TabsTrigger>
            <TabsTrigger value="phone-restorer">
              <Database className="mr-2 h-4 w-4" />
              Phone Restorer
            </TabsTrigger>
            <TabsTrigger value="verification-links">
              <Link2 className="mr-2 h-4 w-4" />
              Verification Links
            </TabsTrigger>
            <TabsTrigger value="deduplicator">
              <Users className="mr-2 h-4 w-4" />
              Deduplicator
            </TabsTrigger>
            <TabsTrigger value="crm-export">
              <Download className="mr-2 h-4 w-4" />
              CRM Export
            </TabsTrigger>
            <TabsTrigger value="enrichment-queue">
              <Zap className="mr-2 h-4 w-4" />
              Enrichment Queue
            </TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="space-y-4">
            <CategoriesManager />
          </TabsContent>

          <TabsContent value="professionals" className="space-y-4">
            <ProfessionalsManager />
          </TabsContent>

          <TabsContent value="applications" className="space-y-4">
            <AgentApplicationsManager />
          </TabsContent>

          <TabsContent value="add-agent" className="space-y-4">
            <ManualAgentAdder />
          </TabsContent>

          <TabsContent value="marketing" className="space-y-4">
            <MarketingContentManager />
          </TabsContent>

          <TabsContent value="zillow" className="space-y-4">
            <ZillowAgentImporter />
          </TabsContent>

          <TabsContent value="agenscrape" className="space-y-4">
            <AgenScrapeImporter />
          </TabsContent>

          <TabsContent value="photos" className="space-y-4">
            <PhotoGenerator />
          </TabsContent>

          <TabsContent value="zip-codes" className="space-y-4">
            <ZipCodeDataConverter />
            <ZipCodeManager />
          </TabsContent>

          <TabsContent value="bio-generator" className="space-y-4">
            <BioGenerator />
          </TabsContent>

          <TabsContent value="zuid-extractor" className="space-y-4">
            <ZuidExtractor />
          </TabsContent>

          <TabsContent value="license-tester" className="space-y-4">
            <LicenseLookupTester />
          </TabsContent>

          <TabsContent value="az-licenses" className="space-y-4">
            <ArizonaLicenseImporter />
            <BulkStatsFetcher />
          </TabsContent>

          <TabsContent value="import-stats" className="space-y-4">
            <AgentStatsImporter />
          </TabsContent>

          <TabsContent value="scraper-debug" className="space-y-4">
            <TestProxyEnrichment />
            <BeauvaisEnricher />
            <ReplicateAgentPhoenix />
            <SingleAgentMemo23 />
            <ZillowScraperDebug />
          </TabsContent>

          <TabsContent value="bulk-enrich" className="space-y-4">
            <BulkMemo23Enricher />
          </TabsContent>

          <TabsContent value="bulk-phoenix" className="space-y-4">
            <BulkPhoenixImporter />
          </TabsContent>

          <TabsContent value="phoenix-memo23" className="space-y-4">
            <PhoenixEnricher />
            <ScottsdaleEnricher />
            <PhoenixMemo23Workflow />
          </TabsContent>

          <TabsContent value="progress-dashboard" className="space-y-4">
            <EnrichmentProgressDashboard />
          </TabsContent>

          <TabsContent value="proxy-health" className="space-y-4">
            <ProxyHealthDashboard />
          </TabsContent>

          <TabsContent value="backfill" className="space-y-4">
            <BackfillScottsdaleRatings />
          </TabsContent>

          <TabsContent value="email-updater" className="space-y-4">
            <BulkEmailUpdater />
          </TabsContent>

          <TabsContent value="phone-restorer" className="space-y-4">
            <PhoneNumberRestorer />
          </TabsContent>

          <TabsContent value="verification-links" className="space-y-4">
            <VerificationLinkGenerator />
          </TabsContent>

          <TabsContent value="deduplicator" className="space-y-4">
            <AgentDeduplicator />
          </TabsContent>

          <TabsContent value="crm-export" className="space-y-4">
            <CRMExportGenerator />
          </TabsContent>

          <TabsContent value="enrichment-queue" className="space-y-4">
            <ContactEnrichmentQueue />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;