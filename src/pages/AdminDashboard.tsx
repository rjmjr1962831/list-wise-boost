import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Tag, Users, FileText, Home, Wand2, FlaskConical, MapPin, UserPlus, Link2, Database, Zap, Briefcase, Download, Image, Sparkles } from "lucide-react";
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
import { ManualAgentAdder } from "@/components/admin/ManualAgentAdder";
import { AgentApplicationsManager } from "@/components/admin/AgentApplicationsManager";
import { ArizonaLicenseImporter } from "@/components/admin/ArizonaLicenseImporter";
import { BulkStatsFetcher } from "@/components/admin/BulkStatsFetcher";
import CitiesManager from "@/components/admin/CitiesManager";
import { AgentDeduplicator } from "@/components/admin/AgentDeduplicator";
import { VerificationLinkGenerator } from "@/components/admin/VerificationLinkGenerator";
import { CRMExportGenerator } from "@/components/admin/CRMExportGenerator";
import { LicenseVerifier } from "@/components/admin/LicenseVerifier";
import { LicenseVerificationReport } from "@/components/admin/LicenseVerificationReport";
import { Memo23FieldsExporter } from "@/components/admin/Memo23FieldsExporter";
import { ContactEnrichmentQueue } from "@/components/admin/ContactEnrichmentQueue";
import { ProxySettings } from "@/components/admin/ProxySettings";
import SpecialtiesManager from "@/components/admin/SpecialtiesManager";
import { OGImageGenerator } from "@/components/admin/OGImageGenerator";
import { BulkZillowReviewsFetcher } from "@/components/admin/BulkZillowReviewsFetcher";
import { MesaDataFixer } from "@/components/admin/MesaDataFixer";
import { EnrichmentProgressDashboard } from "@/components/admin/EnrichmentProgressDashboard";
import { RealtimeEnrichmentDashboard } from "@/components/admin/RealtimeEnrichmentDashboard";
import AvondalePressScraper from "@/components/admin/AvondalePressScraper";
import ManualProfileEnricher from "@/components/admin/ManualProfileEnricher";
import FullEnrichmentPipeline from "@/components/admin/FullEnrichmentPipeline";
import { TestAvondaleEnrichment } from "@/components/admin/TestAvondaleEnrichment";
import { EnrichmentResultsDashboard } from "@/components/admin/EnrichmentResultsDashboard";
import { StopEnrichmentButton } from "@/components/admin/StopEnrichmentButton";

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
            <Button onClick={() => navigate("/og-preview")} variant="outline">
              <Image className="mr-2 h-4 w-4" />
              OG Preview
            </Button>
            <Button onClick={handleLogout} variant="outline">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        <div className="mb-6 p-4 bg-card rounded-lg border">
          <h2 className="text-lg font-semibold mb-2">Quick Actions</h2>
          <div className="flex gap-2 mb-4">
            <StopEnrichmentButton />
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

        <Tabs defaultValue="categories" className="space-y-6">
          <TabsList className="inline-flex w-full max-w-7xl h-auto flex-wrap gap-1 p-2">
            <TabsTrigger value="categories">
              <Tag className="mr-2 h-4 w-4" />
              Categories
            </TabsTrigger>
            <TabsTrigger value="specialties">
              <Tag className="mr-2 h-4 w-4" />
              Specialties
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
            <TabsTrigger value="og-images">
              <Image className="mr-2 h-4 w-4" />
              OG Images
            </TabsTrigger>
            <TabsTrigger value="zip-codes">
              <MapPin className="mr-2 h-4 w-4" />
              Zip Codes
            </TabsTrigger>
            <TabsTrigger value="bio-generator">
              <Wand2 className="mr-2 h-4 w-4" />
              AI Bios
            </TabsTrigger>
            <TabsTrigger value="az-licenses">
              <FlaskConical className="mr-2 h-4 w-4" />
              AZ Licenses
            </TabsTrigger>
            <TabsTrigger value="verify-licenses">
              <FlaskConical className="mr-2 h-4 w-4" />
              Verify Licenses
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
            <TabsTrigger value="mesa-fixer">
              <Zap className="mr-2 h-4 w-4" />
              Mesa Fixer
            </TabsTrigger>
            <TabsTrigger value="proxy-settings">
              <Database className="mr-2 h-4 w-4" />
              Proxy Settings
            </TabsTrigger>
            <TabsTrigger value="zillow-reviews">
              <Home className="mr-2 h-4 w-4" />
              Zillow Reviews
            </TabsTrigger>
            <TabsTrigger value="avondale-press">
              <FileText className="mr-2 h-4 w-4" />
              Avondale Press
            </TabsTrigger>
            <TabsTrigger value="enrich-profiles">
              <Sparkles className="mr-2 h-4 w-4" />
              Enrich Profiles
            </TabsTrigger>
            <TabsTrigger value="full-enrichment">
              <Zap className="mr-2 h-4 w-4" />
              Full Enrichment
            </TabsTrigger>
            <TabsTrigger value="test-avondale">
              <FlaskConical className="mr-2 h-4 w-4" />
              Test Avondale
            </TabsTrigger>
            <TabsTrigger value="results-dashboard">
              <Zap className="mr-2 h-4 w-4" />
              Results Dashboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="space-y-4">
            <CategoriesManager />
          </TabsContent>

          <TabsContent value="specialties" className="space-y-4">
            <SpecialtiesManager />
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

          <TabsContent value="og-images" className="space-y-4">
            <OGImageGenerator />
          </TabsContent>

          <TabsContent value="zip-codes" className="space-y-4">
            <ZipCodeDataConverter />
            <ZipCodeManager />
          </TabsContent>

          <TabsContent value="bio-generator" className="space-y-4">
            <BioGenerator />
          </TabsContent>

          <TabsContent value="az-licenses" className="space-y-4">
            <ArizonaLicenseImporter />
            <BulkStatsFetcher />
          </TabsContent>

          <TabsContent value="verify-licenses" className="space-y-4">
            <LicenseVerifier />
            <LicenseVerificationReport />
            <Memo23FieldsExporter />
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

          <TabsContent value="enrichment-progress" className="space-y-4">
            <EnrichmentProgressDashboard />
          </TabsContent>

          <TabsContent value="enrichment-queue" className="space-y-4">
            <ContactEnrichmentQueue />
          </TabsContent>

          <TabsContent value="realtime-enrichment" className="space-y-4">
            <RealtimeEnrichmentDashboard />
          </TabsContent>

          <TabsContent value="mesa-fixer" className="space-y-4">
            <MesaDataFixer />
          </TabsContent>

          <TabsContent value="proxy-settings" className="space-y-4">
            <ProxySettings />
          </TabsContent>

          <TabsContent value="zillow-reviews" className="space-y-4">
            <BulkZillowReviewsFetcher />
          </TabsContent>

          <TabsContent value="avondale-press" className="space-y-4">
            <AvondalePressScraper />
          </TabsContent>

          <TabsContent value="enrich-profiles" className="space-y-4">
            <ManualProfileEnricher />
          </TabsContent>

          <TabsContent value="full-enrichment" className="space-y-4">
            <FullEnrichmentPipeline />
          </TabsContent>

          <TabsContent value="test-avondale" className="space-y-4">
            <TestAvondaleEnrichment />
          </TabsContent>

          <TabsContent value="results-dashboard" className="space-y-4">
            <EnrichmentResultsDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;