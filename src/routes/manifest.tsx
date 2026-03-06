/**
 * Law 1.2 Static Route Manifest — Zero conditionals, no nested <Routes>.
 * Admin routes are flat entries here (no AdminAppWrapper / inner Routes) to avoid Object.forEach crash.
 */
import React, { lazy } from "react";
import { Navigate } from "react-router-dom";
import type { RouteObject } from "react-router-dom";
import { AdminRouteGuard } from "@/components/AdminRouteGuard";
import { DashboardRedirectWithSearch } from "@/components/DashboardRedirectWithSearch";

import Index from "@/pages/Index";
import NotFound from "@/pages/NotFound";
import { HomeErrorBoundary } from "@/components/HomeErrorBoundary";

const CanonicalAgentProfile = lazy(() => import("@/pages/CanonicalAgentProfile"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const AICompare = lazy(() => import("@/pages/AICompare"));
const WhyAITrustsUs = lazy(() => import("@/pages/WhyAITrustsUs"));
const TermsOfService = lazy(() => import("@/pages/TermsOfService"));
const SMSTerms = lazy(() => import("@/pages/SMSTerms"));
const OptInPolicy = lazy(() => import("@/pages/OptInPolicy"));
const ApplyListing = lazy(() => import("@/pages/ApplyListing"));
const VerifyListing = lazy(() => import("@/pages/VerifyListing"));
const VerifyDetails = lazy(() => import("@/pages/VerifyDetails"));
const VerifySpecialties = lazy(() => import("@/pages/VerifySpecialties"));
const VerifyCities = lazy(() => import("@/pages/VerifyCities"));
const CityLanding = lazy(() => import("@/pages/CityLanding"));
const StateLanding = lazy(() => import("@/pages/StateLanding"));
const CityComingSoon = lazy(() => import("@/pages/CityComingSoon"));
const AlbuquerqueRedirect = lazy(() => import("@/pages/AlbuquerqueRedirect"));
const StateAgentOrCategoryRouter = lazy(() => import("@/pages/StateAgentOrCategoryRouter"));
const NeighborhoodCategoryRouter = lazy(() => import("@/pages/NeighborhoodCategoryRouter"));
const NeighborhoodZipCategoryRouter = lazy(() => import("@/pages/NeighborhoodZipCategoryRouter"));
const MigrateData = lazy(() => import("@/pages/MigrateData"));
const VerifyAgentListing = lazy(() => import("@/pages/VerifyAgentListing"));
const AgentOnboarding = lazy(() => import("@/pages/AgentOnboarding"));
const AreYouAnAgent = lazy(() => import("@/pages/AreYouAnAgent"));
const AgentOnboardingFunnel = lazy(() => import("@/pages/AgentOnboardingFunnel"));
const AgentPaymentSuccess = lazy(() => import("@/pages/AgentPaymentSuccess"));
const AgentInfo = lazy(() => import("@/pages/AgentInfo"));
const AgentLanding = lazy(() => import("@/pages/AgentLanding"));
const AgentSetup = lazy(() => import("@/pages/AgentSetup"));
const AgentDashboard = lazy(() => import("@/pages/agent/AgentDashboard"));
const MagicLinkRouter = lazy(() => import("@/pages/MagicLinkRouter"));
const AgentLogin = lazy(() => import("@/pages/AgentLogin"));
const AgentLoginRequest = lazy(() => import("@/pages/agent/AgentLoginRequest"));
const AgentCodeVerify = lazy(() => import("@/pages/agent/AgentCodeVerify"));
const PaymentComingSoon = lazy(() => import("@/pages/PaymentComingSoon"));
const About = lazy(() => import("@/pages/About"));
const MethodologyPage = lazy(() => import("@/pages/MethodologyPage"));
const RankingMethodologyRedirect = lazy(() => import("@/pages/RankingMethodologyRedirect"));
const MethodologyRedirect = lazy(() => import("@/pages/MethodologyRedirect"));
const ProfileView = lazy(() => import("@/pages/ProfileView"));
const CheckProfile = lazy(() => import("@/pages/CheckProfile"));
const VerifyListingByToken = lazy(() => import("@/pages/VerifyListingByToken"));
const EditProfile = lazy(() => import("@/pages/profile/EditProfile"));
const ProfileFieldsGuide = lazy(() => import("@/pages/profile/ProfileFieldsGuide"));
const PremiumPricingPage = lazy(() => import("@/pages/profile/PremiumPricingPage"));
const SelectCities = lazy(() => import("@/pages/profile/SelectCities"));
const CitySelection = lazy(() => import("@/pages/profile/CitySelection"));
const SelectNeighborhoods = lazy(() => import("@/pages/profile/SelectNeighborhoods"));
const ProfileCheckout = lazy(() => import("@/pages/profile/ProfileCheckout"));
const SelectionPlaceholder = lazy(() => import("@/pages/profile/SelectionPlaceholder"));
const ScheduleCall = lazy(() => import("@/pages/profile/ScheduleCall"));
const ClaimListingPreview = lazy(() => import("@/pages/profile/ClaimListingPreview"));
const ReviewListing = lazy(() => import("@/pages/profile/ReviewListing"));
const FreeCitySelection = lazy(() => import("@/pages/profile/FreeCitySelection"));
const FreeCityConfirmation = lazy(() => import("@/pages/profile/FreeCityConfirmation"));
const HowItWorksPage = lazy(() => import("@/pages/profile/HowItWorksPage"));
const FreeListingThankYou = lazy(() => import("@/pages/profile/FreeListingThankYou"));
const FunnelSuccess = lazy(() => import("@/pages/profile/FunnelSuccess"));
const FunnelIntro = lazy(() => import("@/pages/profile/FunnelIntro"));
const AccuracyReview = lazy(() => import("@/pages/profile/AccuracyReview"));
const FunnelStep0 = lazy(() => import("@/pages/profile/FunnelStep0"));
const ProfileCardPreview = lazy(() => import("@/pages/profile/ProfileCardPreview"));
const AccountSetup = lazy(() => import("@/pages/profile/AccountSetup"));
const StreamlinedOnboarding = lazy(() => import("@/pages/profile/StreamlinedOnboarding"));
const SimpleFunnelTest = lazy(() => import("@/pages/profile/SimpleFunnelTest"));
const Step1Intro = lazy(() => import("@/pages/funnel/Step1Intro"));
const Step2Review1 = lazy(() => import("@/pages/funnel/Step2Review1"));
const Step2bCredentials = lazy(() => import("@/pages/funnel/Step2bCredentials"));
const Step3Review2 = lazy(() => import("@/pages/funnel/Step3Review2"));
const Step4ReviewFinal = lazy(() => import("@/pages/funnel/Step4ReviewFinal"));
const Step5Cities = lazy(() => import("@/pages/funnel/Step5Cities"));
const Step6Neighborhoods = lazy(() => import("@/pages/funnel/Step6Neighborhoods"));
const Step7Pricing = lazy(() => import("@/pages/funnel/Step7Pricing"));
const StepSuccess = lazy(() => import("@/pages/funnel/StepSuccess"));
const PaymentSuccess = lazy(() => import("@/pages/PaymentSuccess"));
const ArtifactPage = lazy(() => import("@/pages/ArtifactPage"));
const BadgeInstructionsPage = lazy(() => import("@/pages/BadgeInstructionsPage"));
const ClaimRedirect = lazy(() => import("@/pages/ClaimRedirect"));
const ShortLinkRedirect = lazy(() => import("@/pages/ShortLinkRedirect"));
const AzMagicLinkRedirect = lazy(() => import("@/pages/AzMagicLinkRedirect"));
const AzNeighborhoodRedirect = lazy(() => import("@/pages/AzNeighborhoodRedirect"));
const CanonicalAgentRedirect = lazy(() => import("@/pages/CanonicalAgentRedirect"));
const QALandingPage = lazy(() => import("@/pages/QALandingPage"));
const QuestionPage = lazy(() => import("@/pages/QuestionPage"));
const FAQ = lazy(() => import("@/pages/FAQ"));
const ZillowPayToPlayPage = lazy(() => import("@/pages/ZillowPayToPlayPage"));
const Press = lazy(() => import("@/pages/Press"));
const ForAI = lazy(() => import("@/pages/ForAI"));
const ForAISystems = lazy(() => import("@/pages/ForAISystems"));
const Transparency = lazy(() => import("@/pages/Transparency"));
const Founder = lazy(() => import("@/pages/Founder"));
const AILiability = lazy(() => import("@/pages/AILiability"));
const AICitationWhitepaper = lazy(() => import("@/pages/AICitationWhitepaper"));
const ProtocolServices = lazy(() => import("@/pages/ProtocolServices"));
const ProtocolAdopters = lazy(() => import("@/pages/ProtocolAdopters"));
const PaymentsSecurity = lazy(() => import("@/pages/PaymentsSecurity"));
const QualifiedAgentsPage = lazy(() => import("@/pages/QualifiedAgentsPage"));
const AreaAgentsPage = lazy(() => import("@/pages/AreaAgentsPage"));
const VisibilityCoveragePage = lazy(() => import("@/pages/VisibilityCoveragePage"));
const VisibilityTiersPage = lazy(() => import("@/pages/VisibilityTiersPage"));
const VisibilityExpertisePage = lazy(() => import("@/pages/VisibilityExpertisePage"));
const VisibilityReviewPage = lazy(() => import("@/pages/VisibilityReviewPage"));
const VisibilitySuccessPage = lazy(() => import("@/pages/VisibilitySuccessPage"));
const AgentLookup = lazy(() => import("@/pages/AgentLookup"));
const CleanRoom = lazy(() => import("@/pages/CleanRoom"));
const NeighborhoodApply = lazy(() => import("@/pages/NeighborhoodApply"));

const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
/** Demo walkthrough: staging-only internal document; never on www. */
const AdminDemo = import.meta.env.VITE_IS_PRODUCTION !== "1"
  ? lazy(() => import("@/pages/admin/AdminDemo"))
  : null;
const AdminLogin = lazy(() => import("@/pages/AdminLogin"));
const AdminExportAgents = lazy(() => import("@/pages/AdminExportAgents"));
const BotAnalyticsDashboard = lazy(() => import("@/pages/BotAnalyticsDashboard"));
const AgentBotAnalyticsDashboard = lazy(() => import("@/pages/AgentBotAnalyticsDashboard"));
const MobilePreview = lazy(() => import("@/pages/MobilePreview"));
const OGPreview = lazy(() => import("@/pages/OGPreview"));
const CRM = lazy(() => import("@/pages/CRM"));
const TestVisibilityComponents = lazy(() => import("@/pages/TestVisibilityComponents"));
const BadgeLevelsPreview = lazy(() => import("@/pages/staging/BadgeLevelsPreview"));
const StagingIndex = lazy(() => import("@/pages/staging/StagingIndex"));
const BadgeDemo = lazy(() => import("@/pages/BadgeDemo"));
const CRMLogin = lazy(() => import("@/pages/admin/crm/CRMLogin"));
const CRMDashboard = lazy(() => import("@/pages/admin/crm/CRMDashboard"));
const CRMAgentList = lazy(() => import("@/pages/admin/crm/AgentList"));
const CRMLeads = lazy(() => import("@/pages/admin/crm/Leads"));
const SequenceDashboard = lazy(() => import("@/pages/admin/crm/SequenceDashboard"));
const HotLeadsPanel = lazy(() => import("@/pages/admin/crm/HotLeadsPanel"));
const CRMLayout = lazy(() => import("@/components/admin/AdminLayout"));

const wrapAdmin = (el: React.ReactNode): React.ReactElement =>
  React.createElement(AdminRouteGuard, null, el);

/** Law 1.2: Flat route array. Admin routes are flat (no nested Routes) to avoid router forEach crash. */
export const routeManifest: RouteObject[] = [
  { path: "/", element: React.createElement(HomeErrorBoundary, null, React.createElement(Index, null)) },
  { path: "/404", element: React.createElement(NotFound, null) },
  { path: "/about", element: React.createElement(About, null) },
  { path: "/about/founder", element: React.createElement(Founder, null) },
  { path: "/about/ranking-methodology", element: React.createElement(MethodologyPage, null) },
  { path: "/ranking-methodology", element: React.createElement(RankingMethodologyRedirect, null) },
  { path: "/methodology", element: React.createElement(MethodologyRedirect, null) },
  { path: "/main", element: React.createElement(Navigate, { to: "/", replace: true }) },
  { path: "/admin/login", element: wrapAdmin(React.createElement(AdminLogin, null)) },
  { path: "/admin", element: wrapAdmin(React.createElement(AdminDashboard, null)) },
  ...(AdminDemo ? [{ path: "/admin/demo", element: wrapAdmin(React.createElement(AdminDemo, null)) }] : []),
  { path: "/admin/crm/login", element: wrapAdmin(React.createElement(CRMLogin, null)) },
  {
    path: "/admin/crm",
    element: wrapAdmin(React.createElement(CRMLayout, null)),
    children: [
      { index: true, element: React.createElement(Navigate, { to: "dashboard", replace: true }) },
      { path: "dashboard", element: React.createElement(CRMDashboard, null) },
      { path: "agents", element: React.createElement(CRMAgentList, null) },
      { path: "leads", element: React.createElement(CRMLeads, null) },
      { path: "sequences", element: React.createElement(SequenceDashboard, null) },
      { path: "hot-leads", element: React.createElement(HotLeadsPanel, null) },
    ],
  },
  { path: "/admin/mobile-preview", element: wrapAdmin(React.createElement(MobilePreview, null)) },
  { path: "/admin/ingest-neighborhoods", element: wrapAdmin(React.createElement(Navigate, { to: "/404", replace: true })) },
  { path: "/admin/neighborhood-writeups", element: wrapAdmin(React.createElement(Navigate, { to: "/404", replace: true })) },
  { path: "/admin/export-agents", element: wrapAdmin(React.createElement(AdminExportAgents, null)) },
  { path: "/a/bot-analytics", element: wrapAdmin(React.createElement(BotAnalyticsDashboard, null)) },
  { path: "/agent/bot-analytics", element: wrapAdmin(React.createElement(AgentBotAnalyticsDashboard, null)) },
  { path: "/og-preview", element: wrapAdmin(React.createElement(OGPreview, null)) },
  { path: "/crm", element: wrapAdmin(React.createElement(CRM, null)) },
  { path: "/test-visibility-components", element: wrapAdmin(React.createElement(TestVisibilityComponents, null)) },
  { path: "/staging", element: React.createElement(StagingIndex, null) },
  { path: "/badge-levels-preview", element: React.createElement(BadgeLevelsPreview, null) },
  { path: "/badge-demo", element: React.createElement(BadgeDemo, null) },
  { path: "/badge-instructions", element: React.createElement(BadgeInstructionsPage, null) },
  { path: "/visibility", element: React.createElement(Navigate, { to: "/visibility/coverage", replace: true }) },
  { path: "/visibility/tiers", element: React.createElement(VisibilityTiersPage, null) },
  { path: "/visibility/coverage", element: React.createElement(VisibilityCoveragePage, null) },
  { path: "/visibility/expertise", element: React.createElement(VisibilityExpertisePage, null) },
  { path: "/visibility/review", element: React.createElement(VisibilityReviewPage, null) },
  { path: "/visibility/success", element: React.createElement(VisibilitySuccessPage, null) },
  { path: "/migrate-data", element: React.createElement(MigrateData, null) },
  { path: "/faq", element: React.createElement(FAQ, null) },
  { path: "/clean-room", element: React.createElement(CleanRoom, null) },
  { path: "/privacy", element: React.createElement(Privacy, null) },
  { path: "/terms", element: React.createElement(TermsOfService, null) },
  { path: "/sms-terms", element: React.createElement(SMSTerms, null) },
  { path: "/opt-in", element: React.createElement(OptInPolicy, null) },
  { path: "/zillow-explained", element: React.createElement(ZillowPayToPlayPage, null) },
  { path: "/press", element: React.createElement(Press, null) },
  { path: "/for-ai", element: React.createElement(ForAI, null) },
  { path: "/for-ai-systems", element: React.createElement(ForAISystems, null) },
  { path: "/transparency", element: React.createElement(Transparency, null) },
  { path: "/ai-compare", element: React.createElement(AICompare, null) },
  { path: "/why-ai-trusts-us", element: React.createElement(WhyAITrustsUs, null) },
  { path: "/ai-liability", element: React.createElement(AILiability, null) },
  { path: "/ai-citation-whitepaper", element: React.createElement(AICitationWhitepaper, null) },
  { path: "/protocol-services", element: React.createElement(ProtocolServices, null) },
  { path: "/protocol-adopters", element: React.createElement(ProtocolAdopters, null) },
  { path: "/payments-security", element: React.createElement(PaymentsSecurity, null) },
  { path: "/check-profile", element: React.createElement(CheckProfile, null) },
  { path: "/check-agent", element: React.createElement(AgentLookup, null) },
  { path: "/agent-info", element: React.createElement(AgentInfo, null) },
  { path: "/apply-listing", element: React.createElement(ApplyListing, null) },
  { path: "/artifact/:agentId", element: React.createElement(ArtifactPage, null) },
  { path: "/join", element: React.createElement(AgentLanding, null) },
  { path: "/agent-setup", element: React.createElement(AgentSetup, null) },
  { path: "/agent/dashboard", element: React.createElement(AgentDashboard, null) },
  { path: "/dashboard", element: React.createElement(DashboardRedirectWithSearch, null) },
  { path: "/dashboard/:token", element: React.createElement(MagicLinkRouter, null) },
  { path: "/agent-login", element: React.createElement(AgentLogin, null) },
  { path: "/agent/login", element: React.createElement(AgentLoginRequest, null) },
  { path: "/agent/verify", element: React.createElement(AgentCodeVerify, null) },
  { path: "/agent-onboarding", element: React.createElement(AgentOnboarding, null) },
  { path: "/are-you-an-agent", element: React.createElement(AreYouAnAgent, null) },
  { path: "/neighborhood/apply", element: React.createElement(NeighborhoodApply, null) },
  { path: "/agent-onboarding/success", element: React.createElement(AgentPaymentSuccess, null) },
  { path: "/agent-payment-success", element: React.createElement(AgentPaymentSuccess, null) },
  { path: "/apply/onboarding", element: React.createElement(AgentOnboardingFunnel, null) },
  { path: "/apply/payment-coming-soon", element: React.createElement(PaymentComingSoon, null) },
  { path: "/verify", element: React.createElement(Navigate, { to: "/verify/ee5a75fc-2a6e-4a03-980e-f40532c55f59", replace: true }) },
  { path: "/verify/:token", element: React.createElement(VerifyListing, null) },
  { path: "/verify/:token/details", element: React.createElement(VerifyDetails, null) },
  { path: "/verify/:token/specialties", element: React.createElement(VerifySpecialties, null) },
  { path: "/verify/:token/cities", element: React.createElement(VerifyCities, null) },
  { path: "/verify-listing/:professionalId", element: React.createElement(VerifyAgentListing, null) },
  { path: "/claim", element: React.createElement(ClaimRedirect, null) },
  { path: "/p/:shortCode", element: React.createElement(ShortLinkRedirect, null) },
  { path: "/funnel-test/:token", element: React.createElement(SimpleFunnelTest, null) },
  { path: "/funnel/:token", element: React.createElement(Step1Intro, null) },
  { path: "/funnel/:token/review-1", element: React.createElement(Step2Review1, null) },
  { path: "/funnel/:token/review-credentials", element: React.createElement(Step2bCredentials, null) },
  { path: "/funnel/:token/review-2", element: React.createElement(Step3Review2, null) },
  { path: "/funnel/:token/review-final", element: React.createElement(Step4ReviewFinal, null) },
  { path: "/funnel/:token/cities", element: React.createElement(Step5Cities, null) },
  { path: "/funnel/:token/neighborhoods", element: React.createElement(Step6Neighborhoods, null) },
  { path: "/funnel/:token/pricing", element: React.createElement(Step7Pricing, null) },
  { path: "/funnel/:token/success", element: React.createElement(StepSuccess, null) },
  { path: "/funnel/:token/payment-success", element: React.createElement(PaymentSuccess, null) },
  { path: "/profile/:token", element: React.createElement(FunnelStep0, null) },
  { path: "/profile/:token/card", element: React.createElement(ProfileCardPreview, null) },
  { path: "/profile/:token/review", element: React.createElement(AccuracyReview, null) },
  { path: "/profile/:token/intro", element: React.createElement(AccuracyReview, null) },
  { path: "/profile/:token/legacy-intro", element: React.createElement(FunnelIntro, null) },
  { path: "/profile/:token/setup", element: React.createElement(AccountSetup, null) },
  { path: "/profile/:token/listing", element: React.createElement(VerifyListingByToken, null) },
  { path: "/profile/:token/fields", element: React.createElement(ProfileFieldsGuide, null) },
  { path: "/profile/:token/edit", element: React.createElement(EditProfile, null) },
  { path: "/profile/:token/preview", element: React.createElement(ClaimListingPreview, null) },
  { path: "/profile/:token/success", element: React.createElement(FunnelSuccess, null) },
  { path: "/profile/:token/payment-success", element: React.createElement(PaymentSuccess, null) },
  { path: "/profile/:token/select-free-city", element: React.createElement(FreeCitySelection, null) },
  { path: "/profile/:token/free-confirmed", element: React.createElement(FreeCityConfirmation, null) },
  { path: "/profile/:token/how-it-works", element: React.createElement(HowItWorksPage, null) },
  { path: "/profile/:token/thank-you", element: React.createElement(FreeListingThankYou, null) },
  { path: "/profile/:token/pricing", element: React.createElement(PremiumPricingPage, null) },
  { path: "/profile/:token/cities", element: React.createElement(CitySelection, null) },
  { path: "/profile/:token/select-cities", element: React.createElement(SelectCities, null) },
  { path: "/profile/:token/select-neighborhoods", element: React.createElement(SelectNeighborhoods, null) },
  { path: "/profile/:token/checkout", element: React.createElement(ProfileCheckout, null) },
  { path: "/profile/:token/select", element: React.createElement(SelectionPlaceholder, null) },
  { path: "/profile/:token/schedule", element: React.createElement(ScheduleCall, null) },
  { path: "/profile-view/:token", element: React.createElement(ProfileView, null) },
  { path: "/coming-soon/:stateSlug/:citySlug", element: React.createElement(CityComingSoon, null) },
  { path: "/albuquerque/:categorySlug", element: React.createElement(AlbuquerqueRedirect, null) },
  { path: "/albuquerque/:categorySlug/:agentSlug", element: React.createElement(AlbuquerqueRedirect, null) },
  { path: "/q/:questionSlug", element: React.createElement(QuestionPage, null) },
  { path: "/:stateSlug/:citySlug/best-real-estate-agents-:year", element: React.createElement(QALandingPage, null) },
  { path: "/:stateSlug/:citySlug/best-real-estate-agents", element: React.createElement(QALandingPage, null) },
  { path: "/az/:citySlug/:neighborhoodSlug/:categorySlug", element: React.createElement(AzNeighborhoodRedirect, null) },
  { path: "/:stateSlug/:citySlug/:zipCode/:neighborhoodSlug/:categorySlug", element: React.createElement(NeighborhoodZipCategoryRouter, null) },
  { path: "/:stateSlug/:citySlug/:zipCode/:neighborhoodSlug/qualified-real-estate-agents", element: React.createElement(QualifiedAgentsPage, null) },
  { path: "/:stateSlug/:citySlug/:zipCode/:neighborhoodSlug/area-agents", element: React.createElement(AreaAgentsPage, null) },
  { path: "/:stateSlug/:citySlug/:neighborhoodSlug/area-agents", element: React.createElement(AreaAgentsPage, null) },
  { path: "/:stateSlug/:citySlug/:neighborhoodSlug/qualified-real-estate-agents", element: React.createElement(QualifiedAgentsPage, null) },
  { path: "/az/:citySlug/:agentSlug", element: React.createElement(AzMagicLinkRedirect, null) },
  { path: "/:stateSlug/agents/:canonicalSlug", element: React.createElement(CanonicalAgentProfile, null) },
  { path: "/:stateSlug/:citySlug/agents/:canonicalSlug", element: React.createElement(CanonicalAgentRedirect, null) },
  { path: "/:stateSlug/:citySlug/:thirdSegment", element: React.createElement(StateAgentOrCategoryRouter, null) },
  { path: "/:stateSlug/:citySlug/:thirdSegment/:fourthSegment", element: React.createElement(NeighborhoodCategoryRouter, null) },
  { path: "/:stateSlug/:citySlug", element: React.createElement(CityLanding, null) },
  { path: "/arizona", element: React.createElement(StateLanding, null) },
  { path: "/california", element: React.createElement(StateLanding, null) },
  { path: "*", element: React.createElement(NotFound, null) },
];
