import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export const Header = () => {
  return (
    <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 bg-primary rounded flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">T10</span>
            </div>
            <span className="text-xl font-bold">
              Top<span className="text-2xl">10</span>Lists.us
            </span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/agent-info" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              About
            </Link>
            <Link to="/agent-setup">
              <Button variant="default" size="sm">
                For Agents
              </Button>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};
