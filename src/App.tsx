// Force rebuild - React import fix
import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { RateLimitGuard } from "@/components/RateLimitGuard";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Loader2 } from "lucide-react";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Lazy load all pages except Index and NotFound for better initial load performance
const DynamicCategoryList = lazy(() => import("./pages/DynamicCategoryList"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Privacy = lazy(() => import("./pages/Privacy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const ApplyListing = lazy(() => import("./pages/ApplyListing"));
const VerifyListing = lazy(() => import("./pages/VerifyListing"));
const VerifyDetails = lazy(() => import("./pages/VerifyDetails"));
const VerifySpecialties = lazy(() => import("./pages/VerifySpecialties"));
const VerifyCities = lazy(() => import("./pages/VerifyCities"));
const CityLanding = lazy(() => import("./pages/CityLanding"));
const CityComingSoon = lazy(() => import("./pages/CityComingSoon"));
const BookAppointment = lazy(() => import("./pages/BookAppointment"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const CRM = lazy(() => import("./pages/CRM"));
const MigrateData = lazy(() => import("./pages/MigrateData"));
const VerifyAgentListing = lazy(() => import("./pages/VerifyAgentListing"));
const AgentOnboarding = lazy(() => import("./pages/AgentOnboarding"));
const AgentOnboardingFunnel = lazy(() => import("./pages/AgentOnboardingFunnel"));
const AgentPayment = lazy(() => import("./pages/AgentPayment"));
const AgentPaymentSuccess = lazy(() => import("./pages/AgentPaymentSuccess"));
const AgentInfo = lazy(() => import("./pages/AgentInfo"));
const AgentLanding = lazy(() => import("./pages/AgentLanding"));
const AgentSetup = lazy(() => import("./pages/AgentSetup"));
const AgentDashboard = lazy(() => import("./pages/AgentDashboard"));
const PaymentComingSoon = lazy(() => import("./pages/PaymentComingSoon"));
const About = lazy(() => import("./pages/About"));
const RankingMethodology = lazy(() => import("./pages/RankingMethodology"));
const OGPreview = lazy(() => import("./pages/OGPreview"));
const ProfileView = lazy(() => import("./pages/ProfileView"));
const AgentProfile = lazy(() => import("./pages/AgentProfile"));

// Agent funnel pages
const WelcomeInterstitial = lazy(() => import("./pages/profile/WelcomeInterstitial"));
const EditProfile = lazy(() => import("./pages/profile/EditProfile"));
const PricingInterstitial = lazy(() => import("./pages/profile/PricingInterstitial"));
const SelectionPlaceholder = lazy(() => import("./pages/profile/SelectionPlaceholder"));
const ScheduleCall = lazy(() => import("./pages/profile/ScheduleCall"));

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <RateLimitGuard>
          <Toaster />
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1">
              <ErrorBoundary>
                <Suspense fallback={
                  <div className="min-h-screen flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                }>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/about/ranking-methodology" element={<RankingMethodology />} />
                    <Route path="/main" element={<Navigate to="/" replace />} />
                    {/* Coming Soon route for non-Arizona cities */}
                    <Route path="/coming-soon/:stateSlug/:citySlug" element={<CityComingSoon />} />
                    {/* Dynamic city and category routes */}
                    <Route path="/:stateSlug/:citySlug" element={<CityLanding />} />
                    <Route path="/:stateSlug/:citySlug/:categorySlug/:agentSlug" element={<AgentProfile />} />
                    <Route path="/:stateSlug/:citySlug/:categorySlug" element={<DynamicCategoryList />} />
                    {/* Admin routes */}
                    <Route path="/admin/login" element={<AdminLogin />} />
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/og-preview" element={<OGPreview />} />
                    <Route path="/crm" element={<CRM />} />
                    <Route path="/migrate-data" element={<MigrateData />} />
                    {/* Static pages */}
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/terms" element={<TermsOfService />} />
                    <Route path="/agent-info" element={<AgentInfo />} />
                    <Route path="/apply-listing" element={<ApplyListing />} />
                    <Route path="/book-appointment-robert" element={<BookAppointment />} />
                    {/* Agent Landing & Onboarding */}
                    <Route path="/join" element={<AgentLanding />} />
                    <Route path="/agent-setup" element={<AgentSetup />} />
                    <Route path="/agent/dashboard" element={<AgentDashboard />} />
                    <Route path="/agent-onboarding" element={<AgentOnboarding />} />
                    <Route path="/agent-onboarding/payment" element={<AgentPayment />} />
                    <Route path="/agent-onboarding/success" element={<AgentPaymentSuccess />} />
                    {/* New Agent Onboarding Funnel */}
                    <Route path="/apply/onboarding" element={<AgentOnboardingFunnel />} />
                    <Route path="/apply/payment-coming-soon" element={<PaymentComingSoon />} />
                    {/* Verification funnel */}
                    <Route path="/verify/:token" element={<VerifyListing />} />
                    <Route path="/verify/:token/details" element={<VerifyDetails />} />
                    <Route path="/verify/:token/specialties" element={<VerifySpecialties />} />
                    <Route path="/verify/:token/cities" element={<VerifyCities />} />
                    <Route path="/verify-listing/:professionalId" element={<VerifyAgentListing />} />
                    {/* Agent funnel routes */}
                    <Route path="/profile/:token" element={<WelcomeInterstitial />} />
                    <Route path="/profile/:token/edit" element={<EditProfile />} />
                    <Route path="/profile/:token/pricing" element={<PricingInterstitial />} />
                    <Route path="/profile/:token/select" element={<SelectionPlaceholder />} />
                    <Route path="/profile/:token/schedule" element={<ScheduleCall />} />
                    {/* Legacy profile view route */}
                    <Route path="/profile-view/:token" element={<ProfileView />} />
                    {/* Catch-all 404 route */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
            </main>
            <Footer />
          </div>
        </RateLimitGuard>
      </QueryClientProvider>
    </BrowserRouter>
  </HelmetProvider>
);

export default App;
