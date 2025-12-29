import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Database, Zap, Briefcase, CreditCard, LayoutDashboard, MailCheck, Upload, Globe, Star } from "lucide-react";
import { toast } from "sonner";
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


const AdminDashboard = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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
          <div className="flex flex-wrap gap-4">
            <Button
              onClick={() => navigate('/dashboard?id=20e0b7f2-5652-424a-9d46-ba74a19cd9a8')}
              variant="outline"
              className="h-auto py-3 border-primary text-primary hover:bg-primary/10"
            >
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Test Dashboard (Robert)
            </Button>
            <Button
              onClick={async () => {
                toast.info("Creating Stripe test checkout...");
                try {
                  const { data, error } = await supabase.functions.invoke('create-agent-checkout', {
                    body: {
                      professionalId: 'test-admin-checkout',
                      email: 'admin@top10lists.us',
                      selectedCities: [{
                        cityId: 'test-city',
                        cityName: 'Test City',
                        price: 1
                      }],
                      allCityIds: ['test-city'],
                      monthlyTotal: 1,
                      successUrl: `${window.location.origin}/agent-payment-success`,
                      cancelUrl: `${window.location.origin}/admin`
                    }
                  });
                  if (error) throw error;
                  if (data?.url) {
                    window.open(data.url, '_blank');
                    toast.success('Stripe checkout opened in new tab');
                  } else {
                    throw new Error('No checkout URL returned');
                  }
                } catch (err: any) {
                  toast.error(`Stripe test failed: ${err.message}`);
                }
              }}
              variant="outline"
              className="h-auto py-3 border-amber-500 text-amber-600 hover:bg-amber-50"
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Test Stripe ($1)
            </Button>
            <Button
              onClick={async () => {
                toast.info("Confirming all emails and syncing to Pipedrive...");
                try {
                  const { data, error } = await supabase.functions.invoke('bulk-confirm-emails');
                  if (error) throw error;
                  toast.success(`Confirmed ${data.confirmed} emails, queued ${data.pipedriveQueued} for Pipedrive sync`);
                } catch (err: any) {
                  toast.error(`Failed: ${err.message}`);
                }
              }}
              variant="outline"
              className="h-auto py-3 border-primary text-primary hover:bg-primary/10"
            >
              <MailCheck className="mr-2 h-4 w-4" />
              Confirm All Emails
            </Button>
          </div>
        </div>

        <Tabs defaultValue="pipedrive-sync" className="space-y-6">
          <TabsList className="inline-flex w-full max-w-7xl h-auto flex-wrap gap-1 p-2">
            <TabsTrigger value="pipedrive-sync">
              <Database className="mr-2 h-4 w-4" />
              Pipedrive Sync
            </TabsTrigger>
            <TabsTrigger value="enrichment-queue">
              <Zap className="mr-2 h-4 w-4" />
              Enrichment Queue
            </TabsTrigger>
            <TabsTrigger value="bulk-synthesis">
              <Zap className="mr-2 h-4 w-4" />
              Profile Synthesis
            </TabsTrigger>
            <TabsTrigger value="license-import">
              <Upload className="mr-2 h-4 w-4" />
              License Import
            </TabsTrigger>
            <TabsTrigger value="cache-warming">
              <Globe className="mr-2 h-4 w-4" />
              Cache Warming
            </TabsTrigger>
            <TabsTrigger value="recent-enrichment">
              <Star className="mr-2 h-4 w-4" />
              Recent Enrichment
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pipedrive-sync" className="space-y-4">
            <BulkPipedriveReQueue />
            <BulkPipedriveSyncAll />
            <AdminPipedriveProfileLinkRepair />
            <AdminPipedriveAutoSync />
            <AdminPipedriveSync />
            <AdminPipedriveDuplicateCleanup />
          </TabsContent>

          <TabsContent value="enrichment-queue" className="space-y-4">
            <ContactEnrichmentQueue />
          </TabsContent>

          <TabsContent value="bulk-synthesis" className="space-y-4">
            <IncompleteSynthesisRunner />
            <BatchSynthesisRefresher />
            <GeminiSearchTester />
            <SynthesisTester />
            <BulkProfileSynthesizer />
          </TabsContent>

          <TabsContent value="license-import" className="space-y-4">
            <BackgroundPipelineControl />
            <ImportCALicenses />
            <StateLicenseImporter />
            <StatePipelineRunner />
          </TabsContent>

          <TabsContent value="cache-warming" className="space-y-4">
            <WarmCacheCronManager />
            <CloudflareCacheManager />
          </TabsContent>

          <TabsContent value="recent-enrichment" className="space-y-4">
            <RecentEnrichmentLinks />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
