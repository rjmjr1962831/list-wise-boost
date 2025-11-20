import { Top10SearchForm } from "@/components/Top10SearchForm";
import { ApplySearchForm } from "@/components/ApplySearchForm";
import { Star } from "lucide-react";
const Index = () => {
  if (import.meta.env.DEV) console.info('[Index] Rendering City Search Index with Top10SearchForm');
  return <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30">
      {/* What Is Top10Lists.us */}
      <section className="container mx-auto px-4 py-20 md:py-32 text-center">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-3xl md:text-4xl font-bold">
            What Is Top10Lists.us?
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
            We are an{" "}
            <span className="font-semibold text-foreground">AI curated directory of the top 10 real estate agents</span> in every major U.S. city.
          </p>
          <p className="text-xl text-muted-foreground leading-relaxed">
            We've pored through dozens of sources and rated about 2,000,000 agents in the U.S.
          </p>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Every Agent on our list has 5.0{" "}
            <span className="inline-flex items-center gap-0.5 align-middle">
              <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
            </span>{" "}
            on every site we have looked at, at least 200 reviews, and been in business for more than 5 years. And that's just where we start!
          </p>
        </div>
      </section>

      {/* Hero Section */}
      <section className="container mx-auto px-4 pt-4 pb-12">
        <div className="max-w-4xl mx-auto space-y-8">
          <Top10SearchForm />
          <ApplySearchForm />
        </div>
      </section>
    </div>;
};
export default Index;