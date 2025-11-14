import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Home } from "lucide-react";

export const Header = () => {
  return (
    <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2" target="_blank" rel="noopener noreferrer">
          <div className="h-8 w-8 bg-primary rounded flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">T10</span>
          </div>
          <span className="text-xl font-bold">
            Top<span className="text-2xl">10</span>Lists.us
          </span>
        </Link>
        <nav className="hidden md:flex gap-6">
          <Link to="/#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors" target="_blank" rel="noopener noreferrer">How It Works</Link>
          <Link to="/#pricing" className="text-muted-foreground hover:text-foreground transition-colors" target="_blank" rel="noopener noreferrer">Pricing</Link>
          <Link to="/#industries" className="text-muted-foreground hover:text-foreground transition-colors" target="_blank" rel="noopener noreferrer">Industries</Link>
          <Link to="/book-appointment-robert" className="text-muted-foreground hover:text-foreground transition-colors" target="_blank" rel="noopener noreferrer">Let's Talk</Link>
        </nav>
        <Button asChild>
          <Link to="/agent-onboarding" target="_blank" rel="noopener noreferrer">Apply Now</Link>
        </Button>
      </div>
    </header>
  );
};
