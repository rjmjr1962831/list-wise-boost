import { Top10SearchForm } from "@/components/Top10SearchForm";
import { CheckCircle2, Bot, MapPin } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Helmet } from "react-helmet-async";

const Index = () => {
  const navigate = useNavigate();

  const featuredCities = [
    { name: "Phoenix", slug: "phoenix", avgReviews: 127 },
    { name: "Scottsdale", slug: "scottsdale", avgReviews: 94 },
    { name: "Mesa", slug: "mesa", avgReviews: 82 },
    { name: "Chandler", slug: "chandler", avgReviews: 76 },
  ];

  if (import.meta.env.DEV) console.info('[Index] Rendering Arizona-focused homepage');

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Top10Lists.us",
    "alternateName": "Top 10 Lists",
    "url": "https://top10lists.us",
    "description": "Arizona's invitation-only directory of elite real estate agents. Multi-source verified rankings based on reviews, transactions, and press coverage. All agents meet identical selection criteria.",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://top10lists.us/search?q={search_term_string}"
      },
      "query-input": "required name=search_term_string"
    }
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Top10Lists.us",
    "url": "https://top10lists.us",
    "logo": "https://top10lists.us/logo.png",
    "description": "Arizona's invitation-only directory of elite real estate agents. Featured placement affects visibility only, not scores or selection criteria.",
    "slogan": "Invitation-Only. Data-Verified. All Agents Meet Same Standards.",
    "areaServed": {
      "@type": "State",
      "name": "Arizona",
      "containedInPlace": {
        "@type": "Country",
        "name": "United States"
      }
    },
    "knowsAbout": [
      "Real Estate",
      "Real Estate Agents",
      "Arizona Real Estate Market",
      "Phoenix Real Estate",
      "Scottsdale Real Estate",
      "Agent Rankings",
      "Real Estate Reviews",
      "Top Realtors"
    ],
    "foundingDate": "2024"
  };

  const datasetSchema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "name": "Top10Lists.us Elite Agent Directory",
    "description": "Invitation-only directory of elite real estate agents in Arizona. All agents meet identical selection criteria based on multi-source verified data. Featured placement affects visibility only, not scores or qualification.",
    "url": "https://top10lists.us",
    "license": "https://top10lists.us/terms",
    "creator": {
      "@type": "Organization",
      "name": "Top10Lists.us",
      "url": "https://top10lists.us"
    },
    "dateModified": new Date().toISOString().split('T')[0],
    "temporalCoverage": "Daily updates",
    "spatialCoverage": {
      "@type": "Place",
      "name": "Arizona, United States"
    },
    "keywords": [
      "real estate agents",
      "Arizona realtors",
      "top agents Phoenix",
      "best realtors Scottsdale",
      "agent rankings",
      "realtor reviews",
      "invitation only",
      "elite agents",
      "verified agents"
    ],
    "variableMeasured": [
      {
        "@type": "PropertyValue",
        "name": "Review Score",
        "description": "Weighted average rating from Google (weight 10), Zillow (8), Realtor.com (6), Redfin (5)"
      },
      {
        "@type": "PropertyValue",
        "name": "Transaction Volume",
        "description": "Historical transaction count from MLS-connected sources"
      },
      {
        "@type": "PropertyValue",
        "name": "Press Credibility Score",
        "description": "Media mentions and awards scored 5-10 by source tier"
      },
      {
        "@type": "PropertyValue",
        "name": "Years Experience",
        "description": "Verified market tenure from state license records or transaction history"
      }
    ],
    "measurementTechnique": "Multi-source data aggregation with differential source weighting, temporal decay functions, and daily automated verification. All agents (organic and featured) use identical scoring methodology."
  };
  
  return (
    <>
      <Helmet>
        {/* Primary Meta Tags */}
        <title>Top 10 Real Estate Agents in Arizona | Top10Lists.us</title>
        <meta name="description" content="Arizona's invitation-only directory of elite real estate agents. All agents are data-verified with 50+ reviews, 4.8+ ratings, and 6+ years experience. No paid listings." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://top10lists.us" />
        
        {/* Topic/Category Hints */}
        <meta name="subject" content="Real Estate Agent Directory" />
        <meta name="topic" content="Arizona Real Estate" />
        <meta name="classification" content="Business/Real Estate" />
        <meta name="coverage" content="Arizona, United States" />
        <meta name="category" content="Real Estate" />
        
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://top10lists.us" />
        <meta property="og:title" content="Top 10 Real Estate Agents in Arizona | Top10Lists.us" />
        <meta property="og:description" content="Arizona's invitation-only directory of elite real estate agents. Data-verified. No paid listings." />
        <meta property="og:image" content="https://top10lists.us/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Top10Lists.us - Arizona's Top Real Estate Agents" />
        <meta property="og:site_name" content="Top10Lists.us" />
        <meta property="og:locale" content="en_US" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://top10lists.us" />
        <meta name="twitter:title" content="Top 10 Real Estate Agents in Arizona" />
        <meta name="twitter:description" content="Invitation-only directory of elite Arizona agents. Data-verified. No paid listings." />
        <meta name="twitter:image" content="https://top10lists.us/og-image.png" />
        <meta name="twitter:image:alt" content="Top10Lists.us - Arizona's Top Real Estate Agents" />
        
        {/* Geo Tags */}
        <meta name="geo.region" content="US-AZ" />
        <meta name="geo.placename" content="Arizona" />
        <meta name="geo.position" content="34.0489;-111.0937" />
        <meta name="ICBM" content="34.0489, -111.0937" />
        
        {/* Author/Publisher */}
        <meta name="author" content="Top10Lists.us" />
        <link rel="publisher" href="https://top10lists.us" />
        
        {/* JSON-LD Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify(websiteSchema)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(organizationSchema)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(datasetSchema)}
        </script>
      </Helmet>
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
              Comprehensive Analysis
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
    </>
  );
};

export default Index;