/**
 * Law 1.2 — Routing via static manifest only. No JSX <Routes> block.
 */
import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, useRoutes, useLocation } from "react-router-dom";
import { SafeHeadProvider } from "@/components/SafeHead";
import { RateLimitGuard } from "@/components/RateLimitGuard";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Chatbot } from "@/components/Chatbot";
import { ScrollToTop } from "@/components/ScrollToTop";
import { StagingAdminLink } from "@/components/StagingAdminLink";
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { routeManifest } from "@/routes/manifest";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const element = useRoutes(routeManifest);
  return element;
};

/** Funnel and dashboard pages: no header, footer, or chatbot. */
function useChromeless(): boolean {
  const { pathname } = useLocation();
  return /^\/(funnel|dashboard|agent\/dashboard)/i.test(pathname);
}

const AppShell = () => {
  const chromeless = useChromeless();
  return (
    <>
      <Toaster />
      <div className="flex flex-col min-h-screen">
        {!chromeless && <StagingAdminLink />}
        {!chromeless && <Header />}
        <main className="flex-1">
          <ErrorBoundary>
            <Suspense
              fallback={
                <div className="min-h-screen flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              }
            >
              <AppRoutes />
            </Suspense>
          </ErrorBoundary>
        </main>
        {!chromeless && <Footer />}
        {!chromeless && <Chatbot />}
        <ScrollToTop />
      </div>
    </>
  );
};

const App = () => (
  <SafeHeadProvider>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <RateLimitGuard>
          <AppShell />
        </RateLimitGuard>
      </QueryClientProvider>
    </BrowserRouter>
  </SafeHeadProvider>
);

export default App;
