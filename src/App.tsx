import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RateLimitGuard } from "@/components/RateLimitGuard";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Loader2 } from "lucide-react";
import { Suspense, lazy } from "react";
import Index from "./pages/Index";
import MainSite from "./pages/MainSite";
import NotFound from "./pages/NotFound";
import Privacy from "./pages/Privacy";
import TermsOfService from "./pages/TermsOfService";
import VerifyListing from "./pages/VerifyListing";
import VerifyDetails from "./pages/VerifyDetails";
import VerifySpecialties from "./pages/VerifySpecialties";
import VerifyCities from "./pages/VerifyCities";
import CityLanding from "./pages/CityLanding";
import BookAppointment from "./pages/BookAppointment";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import MigrateData from "./pages/MigrateData";
import VerifyAgentListing from "./pages/VerifyAgentListing";

const DynamicCategoryList = lazy(() => import("./pages/DynamicCategoryList"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <RateLimitGuard>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1">
              <Suspense fallback={
                <div className="min-h-screen flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              }>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/main" element={<MainSite />} />
                  {/* Dynamic city and category routes */}
                  <Route path="/:stateSlug/:citySlug" element={<CityLanding />} />
                  <Route path="/:stateSlug/:citySlug/:categorySlug" element={<DynamicCategoryList />} />
                  {/* Admin routes */}
                  <Route path="/admin/login" element={<AdminLogin />} />
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/migrate-data" element={<MigrateData />} />
                  {/* Static pages */}
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/terms" element={<TermsOfService />} />
                  <Route path="/book-appointment-robert" element={<BookAppointment />} />
                  {/* Verification funnel */}
                  <Route path="/verify/:token" element={<VerifyListing />} />
                  <Route path="/verify/:token/details" element={<VerifyDetails />} />
                  <Route path="/verify/:token/specialties" element={<VerifySpecialties />} />
                  <Route path="/verify/:token/cities" element={<VerifyCities />} />
                  <Route path="/verify-listing/:professionalId" element={<VerifyAgentListing />} />
                  {/* Catch-all 404 route */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </main>
            <Footer />
          </div>
        </BrowserRouter>
      </RateLimitGuard>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
