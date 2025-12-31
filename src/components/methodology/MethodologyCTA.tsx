import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const MethodologyCTA = () => {
  return (
    <section className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-2xl font-bold mb-4 text-foreground">See who made the cut</h2>
        <p className="text-muted-foreground mb-6">
          Browse our curated list of Arizona's top-performing real estate agents.
        </p>
        <Button asChild size="lg" className="gap-2">
          <Link to="/arizona/phoenix/top10realestateagents">
            Browse Arizona Agents
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
};
