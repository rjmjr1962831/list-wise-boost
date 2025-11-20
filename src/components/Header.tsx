import { Link } from "react-router-dom";

export const Header = () => {
  return (
    <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 bg-primary rounded flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">T10</span>
          </div>
          <span className="text-xl font-bold">
            Top<span className="text-2xl">10</span>Lists.us
          </span>
        </Link>
      </div>
    </header>
  );
};
