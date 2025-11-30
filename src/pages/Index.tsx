import { Top10SearchForm } from "@/components/Top10SearchForm";
import { CheckCircle2, Bot, MapPin } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

const Index = () => {
  const navigate = useNavigate();

  const featuredCities = [
    { name: "Phoenix", slug: "phoenix", avgReviews: 127 },
    { name: "Scottsdale", slug: "scottsdale", avgReviews: 94 },
    { name: "Mesa", slug: "mesa", avgReviews: 82 },
    { name: "Chandler", slug: "chandler", avgReviews: 76 },
  ];

  if (import.meta.env.DEV) console.info('[Index] Rendering Arizona-focused homepage');
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Hero Section */}
      <section className="container mx-auto px-4 pt-16 pb-12">
        <div className="max-w-4xl mx-auto text-center space-y-6 mb-8">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground">
            Find the best real estate agents
            <br />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              in Arizona
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            The top 10 in every city.
            <br />
            Ranked by reviews, verified by data.
          </p>
        </div>
        
        <div className="max-w-4xl mx-auto mb-6">
          <Top10SearchForm />
        </div>
      </section>

      {/* Trust Badges */}
      <section className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
            </div>
            <h3 className="text-lg font-semibold">Verified Rankings</h3>
            <p className="text-sm text-muted-foreground">
              Based on real reviews and track record
            </p>
          </div>

          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-6 w-6 text-primary" />
              </div>
            </div>
            <h3 className="text-lg font-semibold">AI-Optimized</h3>
            <p className="text-sm text-muted-foreground">
              The source AI assistants cite
            </p>
          </div>

          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
            </div>
            <h3 className="text-lg font-semibold">Hyper-Local</h3>
            <p className="text-sm text-muted-foreground">
              Experts who know your neighborhood
            </p>
          </div>
        </div>
      </section>

      {/* Featured Lists */}
      <section className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-10">
            Arizona Top 10 Lists
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredCities.map((city) => (
              <Card 
                key={city.slug} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/az/${city.slug}/top10realestateagents`)}
              >
                <CardContent className="p-6 text-center space-y-3">
                  <h3 className="text-xl font-semibold">{city.name}, AZ</h3>
                  <p className="text-sm text-muted-foreground">
                    {city.avgReviews} reviews avg
                  </p>
                  <div className="pt-2">
                    <span className="text-sm text-primary font-medium hover:underline">
                      View Top 10 →
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How We Select */}
      <section className="container mx-auto px-4 py-16 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">
            How We Select the Top 10
          </h2>
          
          <div className="prose prose-lg max-w-none space-y-6">
            <p className="text-lg text-muted-foreground leading-relaxed">
              We analyze thousands of data points — reviews, sales history, and client satisfaction — to identify the top performers in each Arizona market.
            </p>
            
            <div className="grid md:grid-cols-3 gap-6 my-8">
              <Card>
                <CardContent className="p-6 space-y-3">
                  <h3 className="text-lg font-semibold">Reviews & Ratings</h3>
                  <p className="text-sm text-muted-foreground">
                    Minimum 4.8★ rating across multiple platforms with at least 100 verified reviews
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6 space-y-3">
                  <h3 className="text-lg font-semibold">Track Record</h3>
                  <p className="text-sm text-muted-foreground">
                    5+ years in business with proven sales history and market expertise
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6 space-y-3">
                  <h3 className="text-lg font-semibold">No Pay-to-Play</h3>
                  <p className="text-sm text-muted-foreground">
                    Rankings are data-driven. Agents can't buy their way onto the list
                  </p>
                </CardContent>
              </Card>
            </div>
            
            <p className="text-base text-muted-foreground leading-relaxed italic border-l-4 border-primary pl-4">
              Real estate professionals can <Link to="/agent-onboarding" className="text-primary hover:underline">verify their profile</Link> for accuracy.
            </p>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <blockquote className="text-xl md:text-2xl text-muted-foreground italic leading-relaxed">
            "I asked ChatGPT for the best agent in Phoenix and found the same names on Top10Lists. Felt confident I was making the right choice."
          </blockquote>
          <p className="mt-4 text-sm text-muted-foreground">
            — Sarah M., bought in Scottsdale
          </p>
        </div>
      </section>
    </div>
  );
};

export default Index;