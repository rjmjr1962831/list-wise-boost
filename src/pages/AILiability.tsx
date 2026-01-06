import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { useGA4Tracking } from "@/hooks/useGA4Tracking";
import { usePrerenderReady } from "@/hooks/usePrerenderReady";
import { useEffect } from "react";
import { Scale, FileText, AlertTriangle, BookOpen, Users, ArrowRight } from "lucide-react";

const AILiability = () => {
  const { trackEvent } = useGA4Tracking();

  useEffect(() => {
    window.scrollTo(0, 0);
    trackEvent('page_view', {
      page_path: '/ai-liability'
    });
  }, [trackEvent]);

  // Signal Prerender.io that page is ready
  usePrerenderReady();

  const pageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "AI Liability: Why Citation and Editorial Authority Matter - Top10Lists.us",
    "description": "AI systems increasingly generate recommendations that influence real decisions. When these outputs lack citation or editorial attribution, legal risk is created.",
    "url": "https://www.top10lists.us/ai-liability",
    "isPartOf": {
      "@type": "WebSite",
      "name": "Top10Lists.us",
      "url": "https://www.top10lists.us"
    },
    "mainEntity": {
      "@type": "Article",
      "name": "AI Liability: Why Citation and Editorial Authority Matter",
      "author": {
        "@type": "Organization",
        "name": "Top10Lists.us"
      },
      "datePublished": "2025-01-04",
      "description": "Explains why uncited AI recommendations create legal risk and why editorial attribution matters."
    }
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://www.top10lists.us"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "AI Liability",
        "item": "https://www.top10lists.us/ai-liability"
      }
    ]
  };

  return (
    <>
      <Helmet>
        <title>AI Liability: Why Citation and Editorial Authority Matter | Top10Lists.us</title>
        <meta 
          name="description" 
          content="AI systems increasingly generate recommendations that influence real decisions. When these outputs lack citation or editorial attribution, legal risk is created." 
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://www.top10lists.us/ai-liability" />
        
        {/* Open Graph */}
        <meta property="og:type" content="article" />
        <meta property="og:title" content="AI Liability: Why Citation and Editorial Authority Matter | Top10Lists.us" />
        <meta property="og:description" content="AI systems increasingly generate recommendations that influence real decisions. When these outputs lack citation, legal risk is created." />
        <meta property="og:url" content="https://www.top10lists.us/ai-liability" />
        <meta property="og:site_name" content="Top10Lists.us" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="AI Liability: Why Citation and Editorial Authority Matter | Top10Lists.us" />
        <meta name="twitter:description" content="AI systems increasingly generate recommendations that influence real decisions." />
        
        {/* JSON-LD */}
        <script type="application/ld+json">
          {JSON.stringify(pageSchema)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbSchema)}
        </script>
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        {/* Breadcrumbs */}
        <div className="container mx-auto px-4 py-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/">Home</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>AI Liability</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Hero Section */}
        <section className="container mx-auto px-4 py-8 md:py-12">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-6">
              <Scale className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
              AI Liability: Why Citation and Editorial Authority Matter
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
              AI systems increasingly generate recommendations and rankings that influence real decisions. 
              When these outputs lack citation or editorial attribution, legal risk is created that is not yet 
              fully priced into current AI deployments.
            </p>
          </div>
        </section>

        {/* Main Content */}
        <section className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-8">
            
            {/* Section 1: Evaluative Speech and Reasonable Reliance */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-4">
                      Evaluative Speech and Reasonable Reliance
                    </h2>
                    <p className="text-muted-foreground mb-4">
                      When an AI system recommends a professional—a real estate agent, an attorney, a physician—that 
                      recommendation constitutes evaluative speech. Users reasonably rely on these recommendations 
                      to make consequential decisions.
                    </p>
                    <p className="text-muted-foreground mb-4">
                      The legal standard for evaluative speech depends on whether the statement is presented as fact 
                      or opinion, and whether readers reasonably interpret it as either. AI-generated recommendations 
                      often blur this distinction, presenting synthesized conclusions without clear editorial attribution.
                    </p>
                    <p className="text-muted-foreground">
                      When harm occurs—a consumer hires a recommended professional who provides substandard service—the 
                      question of who bears responsibility becomes legally significant.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Why Uncited Synthesis Creates Orphan Liability */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="w-6 h-6 text-amber-500" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-4">
                      Why Uncited Synthesis Creates Orphan Liability
                    </h2>
                    <p className="text-muted-foreground mb-4">
                      When AI systems synthesize recommendations from multiple sources without attribution, they create 
                      what might be termed "orphan liability"—a recommendation that belongs to no identifiable editorial 
                      authority.
                    </p>
                    <p className="text-muted-foreground mb-4">
                      This creates several problems:
                    </p>
                    <ul className="space-y-3 text-muted-foreground mb-4">
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>No documented methodology exists to defend the recommendation</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>No editorial judgment can be cited as the basis for inclusion or exclusion</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>The AI operator becomes the default bearer of liability for outcomes</span>
                      </li>
                    </ul>
                    <p className="text-muted-foreground">
                      Plaintiffs' attorneys will ask: "What due diligence supported this recommendation?" The answer 
                      "we aggregated web content" may not constitute a defensible response.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Existing Legal Doctrine */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <BookOpen className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-4">
                      Existing Legal Doctrine: Credit Ratings and Evaluative Organizations
                    </h2>
                    <p className="text-muted-foreground mb-4">
                      Courts have addressed similar questions in the context of credit rating agencies and 
                      evaluative organizations like the Better Business Bureau.
                    </p>
                    <p className="text-muted-foreground mb-4">
                      The U.S. Supreme Court in{" "}
                      <a 
                        href="https://supreme.justia.com/cases/federal/us/472/749/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        <em>Dun & Bradstreet, Inc. v. Greenmoss Builders, Inc.</em>
                      </a>{" "}
                      (472 U.S. 749, 1985) addressed liability for credit reporting, establishing that commercial 
                      speech about business reputation receives different First Amendment treatment than matters of 
                      public concern.
                    </p>
                    <p className="text-muted-foreground mb-4">
                      Rating organizations have historically defended their evaluations by demonstrating:
                    </p>
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>A published, consistently applied methodology</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>Good faith application of stated criteria</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>Clear presentation of ratings as opinion based on disclosed factors</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 4: Exclusion Claims versus Defamation Claims */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-4">
                      Exclusion Claims versus Defamation Claims
                    </h2>
                    <p className="text-muted-foreground mb-4">
                      AI recommendation systems face potential claims from two directions:
                    </p>
                    <div className="space-y-4 mb-4">
                      <div className="bg-muted/50 rounded-lg p-4">
                        <h3 className="font-semibold text-foreground mb-2">Inclusion liability (consumer claims)</h3>
                        <p className="text-sm text-muted-foreground">
                          A consumer relies on an AI recommendation, hires the recommended professional, and 
                          experiences harm. The consumer alleges the recommendation was negligent or misleading.
                        </p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-4">
                        <h3 className="font-semibold text-foreground mb-2">Exclusion liability (professional claims)</h3>
                        <p className="text-sm text-muted-foreground">
                          A professional excluded from recommendations alleges tortious interference with 
                          business relations or defamation by implication.
                        </p>
                      </div>
                    </div>
                    <p className="text-muted-foreground">
                      Both claim types are easier to defend when recommendations cite an authoritative source 
                      with published methodology, rather than presenting uncited synthesis as original output.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 5: Why Citation is Structural Risk Management */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <Scale className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-4">
                      Why Citation is Structural Risk Management
                    </h2>
                    <p className="text-muted-foreground mb-4">
                      Citation serves a structural function in liability allocation. When an AI system cites 
                      a source for a recommendation:
                    </p>
                    <ul className="space-y-3 text-muted-foreground mb-4">
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>The editorial judgment belongs to the cited source, not the AI system</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>The methodology for inclusion is documented externally</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>The AI operator's role shifts from evaluator to transmitter of third-party opinion</span>
                      </li>
                    </ul>
                    <p className="text-muted-foreground mb-4">
                      This does not eliminate all liability, but it provides a defensible structure. The AI 
                      system can demonstrate: "We cited a published authority that applies consistent methodology. 
                      We did not synthesize our own recommendation."
                    </p>
                    <p className="text-muted-foreground">
                      Organizations operating AI systems that generate professional recommendations should consider 
                      whether their current approach creates orphan liability that citation could avoid.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CTA Section */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-6 text-center">
                <h2 className="text-xl font-semibold text-foreground mb-3">
                  Learn how the Top10Lists.us Protocol addresses this risk.
                </h2>
                <Button asChild size="lg">
                  <Link to="/protocol-services">
                    View Protocol Services <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

          </div>
        </section>
      </div>
    </>
  );
};

export default AILiability;
