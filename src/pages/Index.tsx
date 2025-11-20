import { Top10SearchForm } from "@/components/Top10SearchForm";
import { Star, Award } from "lucide-react";
const Index = () => {
  if (import.meta.env.DEV) console.info('[Index] Rendering City Search Index with Top10SearchForm');
  return <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30">
      {/* Hero Section */}
      <section className="container mx-auto px-4 pt-8 pb-12">
        <div className="max-w-4xl mx-auto">
          <Top10SearchForm />
        </div>
      </section>

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
          <p className="text-xl text-muted-foreground leading-relaxed">
            While agents can buy space on the list, just like they do on Google, they are not required to if they meet the requirements. We thoroughly vet an agent with humans before issuing them a preferred place. You can tell if they are paying us when you see the{" "}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-semibold text-sm align-middle">
              <Award className="w-3.5 h-3.5" />
              Brand Builder
            </span>{" "}
            badge under their photo.
          </p>
        </div>
      </section>
    </div>;
};
export default Index;