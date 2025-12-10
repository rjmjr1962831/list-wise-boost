// Force rebuild - SMS Terms page added
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
const SMSTerms = lazy(() => import("./pages/SMSTerms"));
const OptInPolicy = lazy(() => import("./pages/OptInPolicy"));
const ApplyListing = lazy(() => import("./pages/ApplyListing"));
const VerifyListing = lazy(() => import("./pages/VerifyListing"));
const VerifyDetails = lazy(() => import("./pages/VerifyDetails"));
const VerifySpecialties = lazy(() => import("./pages/VerifySpecialties"));
const VerifyCities = lazy(() => import("./pages/VerifyCities"));
const CityLanding = lazy(() => import("./pages/CityLanding"));
const StateLanding = lazy(() => import("./pages/StateLanding"));
const CityComingSoon = lazy(() => import("./pages/CityComingSoon"));

const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const CRM = lazy(() => import("./pages/CRM"));
const MigrateData = lazy(() => import("./pages/MigrateData"));
const VerifyAgentListing = lazy(() => import("./pages/VerifyAgentListing"));
const AgentOnboarding = lazy(() => import("./pages/AgentOnboarding"));
const AgentOnboardingFunnel = lazy(() => import("./pages/AgentOnboardingFunnel"));
const AgentPaymentSuccess = lazy(() => import("./pages/AgentPaymentSuccess"));
const AgentInfo = lazy(() => import("./pages/AgentInfo"));
const AgentLanding = lazy(() => import("./pages/AgentLanding"));
const AgentSetup = lazy(() => import("./pages/AgentSetup"));
const AgentDashboard = lazy(() => import("./pages/AgentDashboard"));
const PaymentComingSoon = lazy(() => import("./pages/PaymentComingSoon"));
const About = lazy(() => import("./pages/About"));
const RankingMethodology = lazy(() => import("./pages/RankingMethodology"));
const RankingMethodologyRedirect = lazy(() => import("./pages/RankingMethodologyRedirect"));
const OGPreview = lazy(() => import("./pages/OGPreview"));
const ProfileView = lazy(() => import("./pages/ProfileView"));
const AgentProfile = lazy(() => import("./pages/AgentProfile"));
const CheckProfile = lazy(() => import("./pages/CheckProfile"));
const VerifyListingByToken = lazy(() => import("./pages/VerifyListingByToken"));

// Agent funnel pages
const WelcomeInterstitial = lazy(() => import("./pages/profile/WelcomeInterstitial"));
const EditProfile = lazy(() => import("./pages/profile/EditProfile"));
const ProfileFieldsGuide = lazy(() => import("./pages/profile/ProfileFieldsGuide"));
const PremiumPricingPage = lazy(() => import("./pages/profile/PremiumPricingPage"));
const SelectCities = lazy(() => import("./pages/profile/SelectCities"));
const SelectionPlaceholder = lazy(() => import("./pages/profile/SelectionPlaceholder"));
const ScheduleCall = lazy(() => import("./pages/profile/ScheduleCall"));
const ClaimListingPreview = lazy(() => import("./pages/profile/ClaimListingPreview"));
const ReviewListing = lazy(() => import("./pages/profile/ReviewListing"));
const FreeCitySelection = lazy(() => import("./pages/profile/FreeCitySelection"));
const FunnelIntro = lazy(() => import("./pages/profile/FunnelIntro"));

// Q&A Landing Pages for LLM optimization
const QALandingPage = lazy(() => import("./pages/QALandingPage"));

// FAQ page
const FAQ = lazy(() => import("./pages/FAQ"));

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
                    <Route path="/ranking-methodology" element={<RankingMethodologyRedirect />} />
                    <Route path="/main" element={<Navigate to="/" replace />} />
                    {/* Admin routes */}
                    <Route path="/admin/login" element={<AdminLogin />} />
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/og-preview" element={<OGPreview />} />
                    <Route path="/crm" element={<CRM />} />
                    <Route path="/migrate-data" element={<MigrateData />} />
                    {/* Static pages */}
                    <Route path="/faq" element={<FAQ />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/terms" element={<TermsOfService />} />
                    <Route path="/sms-terms" element={<SMSTerms />} />
                    <Route path="/opt-in" element={<OptInPolicy />} />
                    <Route path="/check-profile" element={<CheckProfile />} />
                    <Route path="/agent-info" element={<AgentInfo />} />
                    <Route path="/apply-listing" element={<ApplyListing />} />
                    
                    {/* Agent Landing & Onboarding */}
                    <Route path="/join" element={<AgentLanding />} />
                    <Route path="/agent-setup" element={<AgentSetup />} />
                    <Route path="/agent/dashboard" element={<AgentDashboard />} />
                    <Route path="/agent-onboarding" element={<AgentOnboarding />} />
                    <Route path="/agent-onboarding/success" element={<AgentPaymentSuccess />} />
                    <Route path="/agent-payment-success" element={<AgentPaymentSuccess />} />
                    {/* New Agent Onboarding Funnel */}
                    <Route path="/apply/onboarding" element={<AgentOnboardingFunnel />} />
                    <Route path="/apply/payment-coming-soon" element={<PaymentComingSoon />} />
                    {/* Verification funnel */}
                    <Route path="/verify/:token" element={<VerifyListing />} />
                    <Route path="/verify/:token/details" element={<VerifyDetails />} />
                    <Route path="/verify/:token/specialties" element={<VerifySpecialties />} />
                    <Route path="/verify/:token/cities" element={<VerifyCities />} />
                    <Route path="/verify-listing/:professionalId" element={<VerifyAgentListing />} />
                    {/* Agent funnel routes - Magic link landing page */}
                    <Route path="/profile/:token" element={<FunnelIntro />} />
                    <Route path="/profile/:token/listing" element={<VerifyListingByToken />} />
                    <Route path="/profile/:token/fields" element={<ProfileFieldsGuide />} />
                    <Route path="/profile/:token/edit" element={<EditProfile />} />
                    <Route path="/profile/:token/preview" element={<ClaimListingPreview />} />
                    <Route path="/profile/:token/review" element={<ReviewListing />} />
                    <Route path="/profile/:token/select-free-city" element={<FreeCitySelection />} />
                    <Route path="/profile/:token/pricing" element={<PremiumPricingPage />} />
                    <Route path="/profile/:token/select-cities" element={<SelectCities />} />
                    <Route path="/profile/:token/select" element={<SelectionPlaceholder />} />
                    <Route path="/profile/:token/schedule" element={<ScheduleCall />} />
                    {/* Legacy profile view route */}
                    <Route path="/profile-view/:token" element={<ProfileView />} />
                    {/* Coming Soon route for non-Arizona cities */}
                    <Route path="/coming-soon/:stateSlug/:citySlug" element={<CityComingSoon />} />
                    {/* Q&A Landing Pages for LLM optimization */}
                    <Route path="/:stateSlug/:citySlug/best-real-estate-agents-:year" element={<QALandingPage />} />
                    <Route path="/:stateSlug/:citySlug/best-real-estate-agents" element={<QALandingPage />} />
                    {/* Dynamic city and category routes - MUST BE LAST before catch-all */}
                    {/* Order: most specific (4-params) first, then 3-params, then 2-params */}
                    <Route path="/:stateSlug/:citySlug/:categorySlug/:agentSlug" element={<AgentProfile />} />
                    <Route path="/:stateSlug/:citySlug/:categorySlug" element={<DynamicCategoryList />} />
                    <Route path="/:stateSlug/:citySlug" element={<CityLanding />} />
                    {/* State landing page - must be after city routes */}
                    <Route path="/arizona" element={<StateLanding />} />
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
