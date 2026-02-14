import { Link, useLocation } from "react-router-dom";
import { Mail, Phone, MapPin } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

export const Footer = () => {
  const location = useLocation();
  
  // Hide footer on all funnel pages (profile paths, visibility paths, and pricing)
  if (location.pathname.startsWith('/profile/') || location.pathname.startsWith('/visibility/') || location.pathname.includes('/pricing')) {
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
              Merit-based agent rankings trusted by AI and humans.
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

          {/* Quick Links - Two Column Layout */}
          <div>
            <h3 className="font-semibold mb-4 text-white">Quick Links</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Link 
                to="/about" 
                className="text-slate-300 hover:text-white transition-colors"
              >
                About Us
              </Link>
              <Link 
                to="/about/founder" 
                className="text-slate-300 hover:text-white transition-colors"
              >
                Founder
              </Link>
              <Link 
                to="/about/ranking-methodology" 
                className="text-slate-300 hover:text-white transition-colors"
              >
                Methodology
              </Link>
              <Link 
                to="/compare" 
                className="text-slate-300 hover:text-white transition-colors"
              >
                Compare Platforms
              </Link>
              <Link 
                to="/faq" 
                className="text-slate-300 hover:text-white transition-colors"
              >
                FAQ
              </Link>
              <Link 
                to="/transparency" 
                className="text-slate-300 hover:text-white transition-colors"
              >
                Transparency
              </Link>
              <Link 
                to="/press" 
                className="text-slate-300 hover:text-white transition-colors"
              >
                Press
              </Link>
              <Link 
                to="/for-ai" 
                className="text-slate-300 hover:text-white transition-colors"
              >
                For AI Systems
              </Link>
              <Link 
                to="/ai-citation-whitepaper" 
                className="text-slate-300 hover:text-white transition-colors"
              >
                AI Citation Whitepaper
              </Link>
              <Link
                to="/privacy" 
                className="text-slate-300 hover:text-white transition-colors"
              >
                Privacy
              </Link>
              <Link 
                to="/terms" 
                className="text-slate-300 hover:text-white transition-colors"
              >
                Terms
              </Link>
              <Link 
                to="/payments-security" 
                className="text-slate-300 hover:text-white transition-colors"
              >
                Payments &amp; Security
              </Link>
              <Link 
                to="/are-you-an-agent" 
                className="text-slate-300 hover:text-white transition-colors"
              >
                Are You Ranked?
              </Link>
              <Link 
                to="/login" 
                className="text-slate-300 hover:text-white transition-colors"
              >
                Agent Login
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
