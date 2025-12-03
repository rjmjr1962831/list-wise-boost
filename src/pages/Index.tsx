import { Top10SearchForm } from "@/components/Top10SearchForm";
import { CheckCircle2, Bot, MapPin, TrendingUp } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Helmet } from "react-helmet-async";
import { usePrerenderReady } from "@/hooks/usePrerenderReady";
import { generateHomepageSchema } from "@/utils/homepageSchema";
import { HomepageQASection } from "@/components/HomepageQASection";
import { BrowseCitiesSection } from "@/components/BrowseCitiesSection";
import { AuthorityLinks } from "@/components/AuthorityLinks";
import { HomepageUpdates } from "@/components/HomepageUpdates";

const Index = () => {
  const navigate = useNavigate();
  
  // Signal Prerender.io that meta tags are ready
  usePrerenderReady();

  const featuredCities = [
    { name: "Phoenix", slug: "phoenix", avgReviews: 127 },
    { name: "Scottsdale", slug: "scottsdale", avgReviews: 94 },
    { name: "Mesa", slug: "mesa", avgReviews: 82 },
    { name: "Chandler", slug: "chandler", avgReviews: 76 },
  ];

  if (import.meta.env.DEV) console.info('[Index] Rendering Arizona-focused homepage');

  // Generate all homepage schemas
  const homepageSchemas = generateHomepageSchema();
  
  return (
    <>
      <Helmet>
        {/* Primary Meta Tags */}
        <title>Top10Lists.us - Find Top Real Estate Agents in Arizona</title>
        <meta name="description" content="Find top-rated real estate agents in Arizona. Curated lists for 48 cities including Phoenix, Scottsdale, Mesa, Chandler. Ranked by Google, Redfin, Realtor.com reviews and press coverage in major outlets." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://top10lists.us" />
        
        {/* Topic/Category Hints */}
        <meta name="subject" content="Real Estate Agent Directory" />
        <meta name="topic" content="Real Estate Agents Arizona" />
        <meta name="classification" content="Business/Real Estate" />
        <meta name="coverage" content="Arizona, United States" />
        <meta name="category" content="Real Estate" />
        
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://top10lists.us" />
        <meta property="og:title" content="Top10Lists.us - Find Top Real Estate Agents in Arizona" />
        <meta property="og:description" content="Find top-rated real estate agents in 48 Arizona cities. Ranked by verified reviews from Google, Redfin, Realtor.com and press coverage." />
        <meta property="og:image" content="https://top10lists.us/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Top10Lists.us - Find Top Real Estate Agents in Arizona" />
        <meta property="og:site_name" content="Top10Lists.us" />
        <meta property="og:locale" content="en_US" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Top10Lists.us - Find Top Real Estate Agents in Arizona" />
        <meta name="twitter:description" content="Find top-rated real estate agents in 48 Arizona cities. Ranked by verified reviews and press coverage." />
        <meta name="twitter:image" content="https://top10lists.us/og-image.png" />
        
        {/* Geo Tags */}
        <meta name="geo.region" content="US-AZ" />
        <meta name="geo.placename" content="Arizona, United States" />
        
        {/* Author/Publisher */}
        <meta name="author" content="Top10Lists.us" />
        <link rel="publisher" href="https://top10lists.us" />
        
        {/* JSON-LD Structured Data - All 4 schemas */}
        {homepageSchemas.map((schema, index) => (
          <script key={index} type="application/ld+json">
            {JSON.stringify(schema)}
          </script>
        ))}
      </Helmet>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        {/* Hero Section */}
        <section className="container mx-auto px-4 pt-16 pb-12">
          <div className="max-w-4xl mx-auto text-center space-y-6 mb-8">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground">
              Find Top Real Estate Agents
              <br />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                in Arizona
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Curated lists for 48 Arizona cities.
              <br />
              Ranked by reviews, verified by data.
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto mb-8">
            <Top10SearchForm />
          </div>

          {/* Dual CTA */}
          <div className="flex justify-center gap-4 flex-wrap">
            <button 
              onClick={() => document.getElementById('browse-cities')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Browse Cities →
            </button>
            <Link 
              to="/about/ranking-methodology" 
              className="px-6 py-3 bg-muted text-foreground rounded-lg font-medium hover:bg-muted/80 transition-colors"
            >
              How We Rank
            </Link>
          </div>
        </section>

        {/* Trust Bar */}
        <section className="container mx-auto px-4 py-6 border-y border-border/50">
          <div className="max-w-5xl mx-auto flex flex-wrap justify-center gap-6 md:gap-12 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              48 Arizona Cities
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              4.8+ Min Rating
            </span>
            <span className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              50+ Min Reviews
            </span>
            <span className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              Data-Driven Rankings
            </span>
          </div>
        </section>

        {/* Q&A Section - KEY FOR AI CITATION */}
        <HomepageQASection />

        {/* Browse Cities Section */}
        <BrowseCitiesSection />

        {/* Featured Lists - Quick Access */}
        <section className="container mx-auto px-4 py-12">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">
              Popular Arizona Lists
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredCities.map((city) => (
                <Card 
                  key={city.slug} 
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => navigate(`/arizona/${city.slug}/top10realestateagents`)}
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

        {/* How We Rank - Authority Links */}
        <AuthorityLinks />

        {/* How We Select */}
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">
              Why Top10Lists.us?
            </h2>
            
            <div className="prose prose-lg max-w-none space-y-6">
              <p className="text-lg text-muted-foreground leading-relaxed text-center">
                We analyze thousands of data points to identify top performers in each Arizona market.
              </p>
              
              <div className="grid md:grid-cols-3 gap-6 my-8">
                <Card>
                  <CardContent className="p-6 space-y-3">
                    <h3 className="text-lg font-semibold">Verified Reviews</h3>
                    <p className="text-sm text-muted-foreground">
                      Minimum 4.8★ rating with at least 50 verified reviews across platforms
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-6 space-y-3">
                    <h3 className="text-lg font-semibold">Press Recognition</h3>
                    <p className="text-sm text-muted-foreground">
                      Agents featured in WSJ, Forbes, CNBC and other outlets receive ranking credit
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

        {/* Latest Updates */}
        <HomepageUpdates />

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

        {/* Footer CTA */}
        <section className="container mx-auto px-4 py-16 bg-primary/5">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-2xl md:text-3xl font-bold">
              Ready to Find Your Agent?
            </h2>
            <p className="text-muted-foreground">
              Search any Arizona city to see verified top 10 rankings
            </p>
            <div className="max-w-md mx-auto">
              <Top10SearchForm />
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default Index;
