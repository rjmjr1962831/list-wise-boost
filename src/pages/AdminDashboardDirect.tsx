import React, { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, Zap, Briefcase, CreditCard, LayoutDashboard, MailCheck, Upload, Globe, Star, TestTube, MapPin, Map } from "lucide-react";
import { ContactEnrichmentQueue } from "@/components/admin/ContactEnrichmentQueue";
import AdminPipedriveSync from "@/components/admin/AdminPipedriveSync";
import { AdminPipedriveAutoSync } from "@/components/admin/AdminPipedriveAutoSync";
import { AdminPipedriveProfileLinkRepair } from "@/components/admin/AdminPipedriveProfileLinkRepair";
import { AdminPipedriveDuplicateCleanup } from "@/components/admin/AdminPipedriveDuplicateCleanup";
import { BulkPipedriveSyncAll } from "@/components/admin/BulkPipedriveSyncAll";
import { BulkPipedriveReQueue } from "@/components/admin/BulkPipedriveReQueue";
import { BulkProfileSynthesizer } from '@/components/admin/BulkProfileSynthesizer';
import { SynthesisTester } from '@/components/admin/SynthesisTester';
import GeminiSearchTester from '@/components/admin/GeminiSearchTester';
import { BatchSynthesisRefresher } from '@/components/admin/BatchSynthesisRefresher';
import { IncompleteSynthesisRunner } from '@/components/admin/IncompleteSynthesisRunner';
import { StateLicenseImporter } from '@/components/admin/StateLicenseImporter';
import { StatePipelineRunner } from '@/components/admin/StatePipelineRunner';
import { BackgroundPipelineControl } from '@/components/admin/BackgroundPipelineControl';
import { ImportCALicenses } from '@/components/admin/ImportCALicenses';
import { CloudflareCacheManager } from '@/components/admin/CloudflareCacheManager';
import { WarmCacheCronManager } from '@/components/admin/WarmCacheCronManager';
import { RecentEnrichmentLinks } from '@/components/admin/RecentEnrichmentLinks';
import { AgentFunnelTester } from '@/components/admin/AgentFunnelTester';
import FunnelTestingTool from '@/components/admin/FunnelTestingTool';
import NearbyNeighborhoodsAudit from '@/components/admin/NearbyNeighborhoodsAudit';
import { ImportAgentZipActivity } from '@/components/admin/ImportAgentZipActivity';
import NeighborhoodAliases from '@/pages/admin/NeighborhoodAliases';

const AdminDashboardDirect = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <Helmet>
        <title>Admin Tools | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-b from-background to-muted p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold mb-2">Admin Tools</h1>
              <p className="text-muted-foreground">Manage system operations and data</p>
            </div>
          </div>

          <Tabs defaultValue="enrichment" className="w-full">
            <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 h-auto mb-8">
              <TabsTrigger value="enrichment" className="flex items-center gap-2">
                <MailCheck className="h-4 w-4" />
                Enrichment
              </TabsTrigger>
              <TabsTrigger value="pipedrive" className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Pipedrive
              </TabsTrigger>
              <TabsTrigger value="synthesis" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Synthesis
              </TabsTrigger>
              <TabsTrigger value="licenses" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Licenses
              </TabsTrigger>
              <TabsTrigger value="cache" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Cache
              </TabsTrigger>
              <TabsTrigger value="funnel" className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                Funnel
              </TabsTrigger>
              <TabsTrigger value="testing" className="flex items-center gap-2">
                <TestTube className="h-4 w-4" />
                Testing
              </TabsTrigger>
              <TabsTrigger value="neighborhoods" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Neighborhoods
              </TabsTrigger>
            </TabsList>

            <TabsContent value="enrichment" className="space-y-4">
              <ContactEnrichmentQueue />
              <RecentEnrichmentLinks />
            </TabsContent>

            <TabsContent value="pipedrive" className="space-y-4">
              <AdminPipedriveSync />
              <AdminPipedriveAutoSync />
              <BulkPipedriveSyncAll />
              <BulkPipedriveReQueue />
              <AdminPipedriveProfileLinkRepair />
              <AdminPipedriveDuplicateCleanup />
            </TabsContent>

            <TabsContent value="synthesis" className="space-y-4">
              <BulkProfileSynthesizer />
              <BatchSynthesisRefresher />
              <IncompleteSynthesisRunner />
              <SynthesisTester />
            </TabsContent>

            <TabsContent value="licenses" className="space-y-4">
              <StateLicenseImporter />
              <ImportCALicenses />
              <ImportAgentZipActivity />
              <StatePipelineRunner />
              <BackgroundPipelineControl />
            </TabsContent>

            <TabsContent value="cache" className="space-y-4">
              <CloudflareCacheManager />
              <WarmCacheCronManager />
            </TabsContent>

            <TabsContent value="funnel" className="space-y-4">
              <AgentFunnelTester />
              <FunnelTestingTool />
            </TabsContent>

            <TabsContent value="testing" className="space-y-4">
              <GeminiSearchTester />
            </TabsContent>

            <TabsContent value="neighborhoods" className="space-y-4">
              <NeighborhoodAliases />
              <NearbyNeighborhoodsAudit />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
};

export default AdminDashboardDirect;
