/**
 * Admin routes - only loaded when VITE_IS_PRODUCTION is not set (e.g. staging).
 * Production builds exclude this chunk entirely; all /admin and admin-only paths 404.
 */
import React, { lazy } from "react";
import { Route, Navigate } from "react-router-dom";
import { AdminRouteGuard } from "@/components/AdminRouteGuard";

const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminExportAgents = lazy(() => import("./pages/AdminExportAgents"));
const BotAnalyticsDashboard = lazy(() => import("./pages/BotAnalyticsDashboard"));
const AgentBotAnalyticsDashboard = lazy(() => import("./pages/AgentBotAnalyticsDashboard"));
const MobilePreview = lazy(() => import("./pages/MobilePreview"));
const OGPreview = lazy(() => import("./pages/OGPreview"));
const CRM = lazy(() => import("./pages/CRM"));
const TestVisibilityComponents = lazy(() => import("./pages/TestVisibilityComponents"));

const CRMLogin = lazy(() => import("./pages/admin/crm/CRMLogin"));
const CRMDashboard = lazy(() => import("./pages/admin/crm/CRMDashboard"));
const CRMAgentList = lazy(() => import("./pages/admin/crm/AgentList"));
const CRMLeads = lazy(() => import("./pages/admin/crm/Leads"));
const CRMLayout = lazy(() => import("@/components/admin/AdminLayout"));

export function AdminRoutes() {
  return (
    <>
      <Route path="/admin/login" element={<AdminRouteGuard><AdminLogin /></AdminRouteGuard>} />
      <Route path="/admin" element={<AdminRouteGuard><AdminDashboard /></AdminRouteGuard>} />
      <Route path="/admin/crm/login" element={<AdminRouteGuard><CRMLogin /></AdminRouteGuard>} />
      <Route path="/admin/crm" element={<AdminRouteGuard><CRMLayout /></AdminRouteGuard>}>
        <Route path="dashboard" element={<CRMDashboard />} />
        <Route path="agents" element={<CRMAgentList />} />
        <Route path="leads" element={<CRMLeads />} />
      </Route>
      <Route path="/admin/mobile-preview" element={<AdminRouteGuard><MobilePreview /></AdminRouteGuard>} />
      <Route path="/admin/ingest-neighborhoods" element={<AdminRouteGuard><Navigate to="/404" replace /></AdminRouteGuard>} />
      <Route path="/admin/neighborhood-writeups" element={<AdminRouteGuard><Navigate to="/404" replace /></AdminRouteGuard>} />
      <Route path="/admin/export-agents" element={<AdminRouteGuard><AdminExportAgents /></AdminRouteGuard>} />
      <Route path="/a/bot-analytics" element={<AdminRouteGuard><BotAnalyticsDashboard /></AdminRouteGuard>} />
      <Route path="/agent/bot-analytics" element={<AdminRouteGuard><AgentBotAnalyticsDashboard /></AdminRouteGuard>} />
      <Route path="/og-preview" element={<AdminRouteGuard><OGPreview /></AdminRouteGuard>} />
      <Route path="/crm" element={<AdminRouteGuard><CRM /></AdminRouteGuard>} />
      <Route path="/test-visibility-components" element={<AdminRouteGuard><TestVisibilityComponents /></AdminRouteGuard>} />
    </>
  );
}
