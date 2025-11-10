import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RateLimitGuard } from "@/components/RateLimitGuard";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import Index from "./pages/Index";
import MainSite from "./pages/MainSite";
import NotFound from "./pages/NotFound";
import SampleDentistList from "./pages/SampleDentistList";
import GilbertRealEstateAgentList from "./pages/GilbertRealEstateAgentList";
import Privacy from "./pages/Privacy";
import TermsOfService from "./pages/TermsOfService";
import CityLanding from "./pages/CityLanding";
import DynamicCategoryList from "./pages/DynamicCategoryList";
import BookAppointment from "./pages/BookAppointment";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";

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
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/main" element={<MainSite />} />
                {/* Legacy routes */}
                <Route path="/az/gilbert/top10dentists" element={<SampleDentistList />} />
                <Route path="/az/gilbert/top10realestateagents" element={<GilbertRealEstateAgentList />} />
                {/* Dynamic city and category routes */}
                <Route path="/:stateSlug/:citySlug" element={<CityLanding />} />
                <Route path="/:stateSlug/:citySlug/:categorySlug" element={<DynamicCategoryList />} />
                {/* Admin routes */}
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin" element={<AdminDashboard />} />
                {/* Static pages */}
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="/book-appointment-robert" element={<BookAppointment />} />
                {/* Catch-all 404 route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </BrowserRouter>
      </RateLimitGuard>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
