import { Link, useLocation } from "react-router-dom";
import { Mail, Phone, MapPin } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

export const Footer = () => {
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  
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

          {/* Legal Links */}
          <div>
            <h3 className="font-semibold mb-4 text-white">Legal</h3>
            <div className="space-y-2 text-sm">
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

        {/* Agent CTA - Subtle (only on homepage) */}
        {isHomePage && (
          <div className="mt-8 pt-8 border-t border-slate-700">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-sm text-slate-400">
                &copy; {new Date().getFullYear()} Top<span className="font-semibold">10</span>Lists.us. All rights reserved.
              </p>
              <Link 
                to="/agent-onboarding" 
                className="text-sm text-slate-400 hover:text-blue-400 transition-colors"
              >
                Real estate professional? Check if you're ranked →
              </Link>
            </div>
          </div>
        )}
        
        {!isHomePage && (
          <div className="mt-8 pt-8 border-t border-slate-700 text-center text-sm text-slate-400">
            <p>&copy; {new Date().getFullYear()} Top<span className="font-semibold">10</span>Lists.us. All rights reserved.</p>
          </div>
        )}
      </div>
    </footer>
  );
};
