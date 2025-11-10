import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Home } from "lucide-react";

export const Header = () => {
  return (
    <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 bg-primary rounded flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">T10</span>
          </div>
          <span className="text-xl font-bold">Top10Lists.us</span>
        </Link>
        <nav className="hidden md:flex gap-6">
          <a href="/main#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">How It Works</a>
          <a href="/main#pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
          <a href="/main#industries" className="text-muted-foreground hover:text-foreground transition-colors">Industries</a>
          <Link to="/book-appointment-robert" className="text-muted-foreground hover:text-foreground transition-colors">Let's Talk</Link>
        </nav>
        <Button asChild>
          <Link to="/main">Get Listed</Link>
        </Button>
      </div>
    </header>
  );
};
