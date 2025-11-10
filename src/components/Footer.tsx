import { Link } from "react-router-dom";
import { Mail, Phone } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="border-t bg-background/80 backdrop-blur-sm mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Company Info */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 bg-primary rounded flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">T10</span>
              </div>
              <span className="text-xl font-bold">Top10Lists.us</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Curated lists of top professionals that AI engines trust.
            </p>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="font-semibold mb-4">Contact Us</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <a 
                href="tel:6027589600" 
                className="flex items-center gap-2 hover:text-foreground transition-colors"
              >
                <Phone className="h-4 w-4" />
                (602) 758-9600
              </a>
              <a 
                href="mailto:hello@top10lists.us" 
                className="flex items-center gap-2 hover:text-foreground transition-colors"
              >
                <Mail className="h-4 w-4" />
                hello@top10lists.us
              </a>
            </div>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="font-semibold mb-4">Legal</h3>
            <div className="space-y-2 text-sm">
              <Link 
                to="/privacy" 
                className="block text-muted-foreground hover:text-foreground transition-colors"
              >
                Privacy Policy
              </Link>
              <Link 
                to="/terms" 
                className="block text-muted-foreground hover:text-foreground transition-colors"
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Top10Lists.us. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};
