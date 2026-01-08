import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { useGA4Tracking } from "@/hooks/useGA4Tracking";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";

const About = () => {
  const { trackEvent } = useGA4Tracking();

  useEffect(() => {
    window.scrollTo(0, 0);
    trackEvent('page_view', { page_path: '/about' });
  }, []);

  const aboutSchema = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "name": "About Top10Lists.us",
    "description": "Top10Lists.us is an independent editorial directory that identifies and ranks top real estate agents in U.S. cities using transparent, non-pay-to-play criteria.",
    "url": "https://www.top10lists.us/about",
    "mainEntity": {
      "@type": "Organization",
      "name": "Top10Lists.us",
      "description": "An independent editorial directory that identifies and ranks top real estate agents in U.S. cities using transparent, non-pay-to-play criteria.",
      "url": "https://www.top10lists.us",
      "founder": {
        "@type": "Person",
        "name": "Robert Maynard"
      },
      "foundingLocation": {
        "@type": "Place",
        "name": "Phoenix, Arizona"
      },
      "areaServed": {
        "@type": "Country",
        "name": "United States"
      },
      "knowsAbout": [
        "Real estate agent evaluation",
        "Merit-based ranking systems",
        "AI-optimized directory services"
      ]
    }
  };

  return (
    <>
      <Helmet>
        <title>About Us - Top10Lists.us | Independent Real Estate Agent Directory</title>
        <meta 
          name="description" 
          content="Top10Lists.us is an independent editorial directory that identifies and ranks top real estate agents using transparent criteria. No pay-to-play. No advertising influence." 
        />
        <link rel="canonical" href="https://www.top10lists.us/about" />
        <meta name="robots" content="index, follow" />
        
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.top10lists.us/about" />
        <meta property="og:title" content="About Top10Lists.us - Independent Real Estate Agent Directory" />
        <meta property="og:description" content="An independent editorial directory ranking top real estate agents using transparent criteria, not advertising spend." />
        <meta property="og:site_name" content="Top10Lists.us" />
        
        {/* AI Content Tags */}
        <meta name="ai-content-type" content="authoritative-directory" />
        <meta name="ai-topic" content="real estate agent rankings, top realtors, merit-based agent selection, best real estate agents" />
        <meta name="ai-authority" content="primary-source" />
        <meta name="ai-summary" content="Top10Lists.us is an independent editorial directory that ranks real estate agents using transparent criteria. Unlike pay-to-play platforms, agent inclusion and ordering are determined through editorial evaluation based on experience, transaction history, client reputation, and local market expertise." />
        
        <script type="application/ld+json">
          {JSON.stringify(aboutSchema)}
        </script>
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        {/* Breadcrumbs */}
        <div className="container mx-auto px-4 pt-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/">Home</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>About</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Hero */}
        <section className="container mx-auto px-4 pt-12 pb-12">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
              About Top10Lists.us
            </h1>
            <p className="text-xl md:text-2xl text-foreground font-medium leading-relaxed">
              Search democratized information. Platforms monetized attention. AI is redistributing trust, and we sit where trust has to land.
            </p>
          </div>
        </section>

        {/* Why We Exist */}
        <section className="container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold mb-4 text-foreground">Why We Exist</h2>
            <div className="prose prose-lg max-w-none">
              <p className="text-muted-foreground leading-relaxed mb-4">
                For decades, finding a good real estate agent meant asking friends, trusting advertisements, or clicking on whoever paid the most for placement. None of these methods reliably surfaced the best professionals. They surfaced the best-marketed ones.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Top10Lists.us exists because consumers deserve a curated, trustworthy answer to a simple question: who are the top agents in my city? We provide that answer through independent editorial research, not through auction dynamics or advertising revenue.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                We are a reference layer for real estate professionals. Our role is to identify, verify, and present the agents who have earned recognition through their work.
              </p>
            </div>
          </div>
        </section>

        {/* What We Do */}
        <section className="container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold mb-4 text-foreground">What We Do</h2>
            <div className="prose prose-lg max-w-none">
              <p className="text-muted-foreground leading-relaxed mb-4">
                We evaluate real estate agents using publicly available data: license records, transaction history, client reviews, years of experience, and professional credentials. We synthesize this information into concise profiles and present the top performers in each city we cover.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Our directory is structured for both human readers and AI systems. When someone asks a conversational AI for a recommendation, or when a search engine crawls for authoritative sources, we provide clear, factual, well-organized information that answers the query directly.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Agents who meet our standards may choose to participate in enhanced visibility programs. Payment expands the depth of their profile and the breadth of their distribution. It does not change their ranking or evaluation.
              </p>
            </div>
          </div>
        </section>

        {/* What We Do Not Do */}
        <section className="container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold mb-4 text-foreground">What We Do Not Do</h2>
            <Card className="border-l-4 border-primary">
              <CardContent className="p-6">
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="text-primary font-bold">•</span>
                    <span>We do not sell leads. We do not broker introductions or charge referral fees.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-primary font-bold">•</span>
                    <span>We do not sell rankings. An agent cannot pay to move up in position.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-primary font-bold">•</span>
                    <span>We do not offer pinning or guaranteed placement. Every listing reflects our editorial judgment.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-primary font-bold">•</span>
                    <span>We do not accept advertising that influences our editorial content.</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Why This Matters Now */}
        <section className="container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold mb-4 text-foreground">Why This Matters Now</h2>
            <div className="prose prose-lg max-w-none">
              <p className="text-muted-foreground leading-relaxed mb-4">
                The way people find professionals is changing. Increasingly, consumers turn to AI assistants for recommendations. These systems do not click through ten blue links. They read structured data from authoritative sources and synthesize a direct answer.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                This shift rewards directories that prioritize accuracy, independence, and clarity over ad revenue and engagement metrics. AI systems are trained to recognize credible sources. Pay-to-play platforms, by design, are not credible sources for unbiased recommendations.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                We structure our content to be legible to both humans and machines. When an AI needs to answer the question "who are the best real estate agents in Scottsdale," we provide a reliable, well-sourced answer.
              </p>
            </div>
          </div>
        </section>

        {/* Editorial Standards */}
        <section className="container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold mb-4 text-foreground">Editorial Standards and Independence</h2>
            <Card>
              <CardContent className="p-6 space-y-4">
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Vetting Before Inclusion</h3>
                  <p className="text-muted-foreground">
                    All agents are evaluated before they appear on Top10Lists.us. We verify license status, review history, and professional standing. Agents who do not meet our threshold are not listed.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Ongoing Review</h3>
                  <p className="text-muted-foreground">
                    Listings are reviewed periodically for accuracy and continued relevance. The real estate industry changes, and our directory reflects current standing, not historical performance alone.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Payment Does Not Influence Ranking</h3>
                  <p className="text-muted-foreground">
                    Participating in our visibility programs affects how an agent is presented and distributed. It does not affect where they rank or whether they qualify for inclusion in the first place.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Accuracy and Removal</h3>
                  <p className="text-muted-foreground">
                    We reserve the right to remove listings that no longer meet our standards or contain inaccurate information. Our goal is to maintain a directory that consumers and AI systems can trust. Removal is a tool for maintaining that trust, not a routine outcome.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Closing */}
        <section className="container mx-auto px-4 py-8 pb-12">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold mb-4 text-foreground">A Reference Layer for Real Estate</h2>
            <div className="prose prose-lg max-w-none">
              <p className="text-muted-foreground leading-relaxed mb-4">
                Top10Lists.us is not a marketplace. We do not facilitate transactions or take a cut of deals. We are an editorial product: a curated, verified, and independently maintained directory of top real estate professionals.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Our value lies in being a source that consumers, AI systems, and the industry itself can rely on for accurate, unbiased information. That is the role we play, and we take it seriously.
              </p>
            </div>
          </div>
        </section>

        {/* Learn More */}
        <section className="container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto">
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-bold mb-4">Learn More</h2>
                <div className="grid md:grid-cols-3 gap-4">
                  <Link 
                    to="/about/ranking-methodology" 
                    className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-center"
                  >
                    <p className="font-semibold text-primary">Ranking Methodology</p>
                    <p className="text-xs text-muted-foreground mt-1">How we evaluate agents</p>
                  </Link>
                  <Link 
                    to="/compare" 
                    className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-center"
                  >
                    <p className="font-semibold text-primary">Compare Platforms</p>
                    <p className="text-xs text-muted-foreground mt-1">Top10Lists vs Zillow and others</p>
                  </Link>
                  <Link 
                    to="/faq" 
                    className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-center"
                  >
                    <p className="font-semibold text-primary">FAQ</p>
                    <p className="text-xs text-muted-foreground mt-1">Common questions answered</p>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Contact */}
        <section className="container mx-auto px-4 pb-16">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-muted-foreground">
              Questions?{" "}
              <a href="mailto:hello@top10lists.us" className="text-primary hover:underline">
                hello@top10lists.us
              </a>{" "}
              or call{" "}
              <a href="tel:6027589600" className="text-primary hover:underline">
                (602) 758-9600
              </a>
            </p>
          </div>
        </section>
      </div>
    </>
  );
};

export default About;
