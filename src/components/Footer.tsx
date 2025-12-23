import { Link, useLocation } from "react-router-dom";
import { Mail, Phone, MapPin } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

export const Footer = () => {
  const location = useLocation();
  
  // Hide footer on all funnel pages (profile paths and pricing)
  if (location.pathname.startsWith('/profile/') || location.pathname.includes('/pricing')) {
    return null;
  }

  return (
    <footer className="bg-gradient-to-br from-slate-900 to-slate-800 text-white mt-auto">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Company Info */}
          <div>
            <Logo variant="dark" className="mb-4" />
            <p className="text-sm text-slate-300">
              Curated lists of top professionals that AI engines trust.
            </p>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="font-semibold mb-4 text-white">Contact Us</h3>
            <div className="space-y-3 text-sm text-slate-300">
              <a 
                href="https://www.google.com/maps/search/?api=1&query=3241+E+Shea+Blvd+Suite+130+Phoenix+AZ+85028"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 hover:text-white transition-colors"
              >
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  3241 E Shea Blvd<br />
                  Suite 130<br />
                  Phoenix, AZ 85028
                </span>
              </a>
              <a 
                href="tel:6027589600" 
                className="flex items-center gap-2 hover:text-white transition-colors"
              >
                <Phone className="h-4 w-4" />
                (602) 758-9600
              </a>
              <a 
                href="mailto:hello@top10lists.us" 
                className="flex items-center gap-2 hover:text-white transition-colors"
              >
                <Mail className="h-4 w-4" />
                hello@top10lists.us
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-4 text-white">Quick Links</h3>
            <div className="space-y-2 text-sm">
              <Link 
                to="/about" 
                className="block text-slate-300 hover:text-white transition-colors"
              >
                About Us
              </Link>
              <Link 
                to="/about/ranking-methodology" 
                className="block text-slate-300 hover:text-white transition-colors"
              >
                Methodology
              </Link>
              <Link 
                to="/compare" 
                className="block text-slate-300 hover:text-white transition-colors"
              >
                Compare Platforms
              </Link>
              <Link 
                to="/faq" 
                className="block text-slate-300 hover:text-white transition-colors"
              >
                FAQ
              </Link>
              <Link 
                to="/editorial-updates" 
                className="block text-slate-300 hover:text-white transition-colors"
              >
                Updates
              </Link>
              <Link 
                to="/transparency" 
                className="block text-slate-300 hover:text-white transition-colors"
              >
                Transparency Report
              </Link>
              <Link 
                to="/press" 
                className="block text-slate-300 hover:text-white transition-colors"
              >
                Press
              </Link>
              <Link 
                to="/for-ai" 
                className="block text-slate-300 hover:text-white transition-colors"
              >
                For AI Systems
              </Link>
              <Link 
                to="/privacy" 
                className="block text-slate-300 hover:text-white transition-colors"
              >
                Privacy Policy
              </Link>
              <Link 
                to="/terms" 
                className="block text-slate-300 hover:text-white transition-colors"
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-slate-700 space-y-4">
          {/* Nationwide expansion signal */}
          <div className="text-center">
            <p className="text-sm font-medium text-slate-300">
              Launching nationwide. Coverage expanding monthly.
            </p>
          </div>
          
          {/* Authority statement */}
          <div className="text-center">
            <p className="text-xs text-slate-500">
              Rankings are methodology-driven and non-pay-to-play. Expanding nationwide.{" "}
              <Link 
                to="/about/ranking-methodology" 
                className="hover:text-slate-300 transition-colors underline"
              >
                How we qualify agents →
              </Link>
            </p>
          </div>

          {/* Subtle Agent Note */}
          <div className="text-center py-4 border-t border-slate-600">
            <p className="text-sm text-slate-400">
              Real estate professional?{" "}
              <Link 
                to="/are-you-an-agent" 
                className="text-slate-300 hover:text-white transition-colors"
              >
                Check if you're ranked →
              </Link>
            </p>
          </div>

          <div className="text-center text-sm text-slate-400">
            <p>&copy; {new Date().getFullYear()} Top<span className="font-semibold">10</span>Lists.us. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
};
