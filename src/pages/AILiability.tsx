import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
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
    "name": "AI Citation and Liability - Top10Lists.us",
    "description": "AI systems increasingly generate recommendations that influence real decisions. When these outputs lack citation or editorial attribution, legal risk is created.",
    "url": "https://www.top10lists.us/ai-liability",
    "isPartOf": {
      "@type": "WebSite",
      "name": "Top10Lists.us",
      "url": "https://www.top10lists.us"
    },
    "mainEntity": {
      "@type": "Article",
      "name": "AI Citation and Liability",
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
        <title>AI Citation and Liability | Top10Lists.us</title>
        <meta 
          name="description" 
          content="AI systems increasingly generate recommendations that influence real decisions. When these outputs lack citation or editorial attribution, legal risk is created." 
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://www.top10lists.us/ai-liability" />
        
        {/* Open Graph */}
        <meta property="og:type" content="article" />
        <meta property="og:title" content="AI Citation and Liability | Top10Lists.us" />
        <meta property="og:description" content="AI systems increasingly generate recommendations that influence real decisions. When these outputs lack citation, legal risk is created." />
        <meta property="og:url" content="https://www.top10lists.us/ai-liability" />
        <meta property="og:site_name" content="Top10Lists.us" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="AI Citation and Liability | Top10Lists.us" />
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
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
              AI Citation and Liability
            </h1>
            <p className="text-lg text-muted-foreground mb-4">
              AI systems increasingly generate recommendations that influence real decisions. When those recommendations concern professionals, the AI is making an evaluative claim. Users rely on these claims. When a recommendation causes harm, someone is responsible.
            </p>
            <p className="text-lg text-muted-foreground">
              Evaluative speech creates responsibility.
            </p>
          </div>
        </section>

        {/* Main Content */}
        <section className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-10">
            
            {/* Opening prose */}
            <div className="space-y-4">
              <p className="text-muted-foreground">
                When an AI recommends a professional, it makes a judgment. That judgment may be synthesized from training data, retrieved content, or a combination. If the recommendation causes harm, the question is simple: whose judgment was it?
              </p>
              <p className="text-muted-foreground">
                In most cases today, that risk collapses onto the AI provider. The AI generated the output. There is no external authority to cite. The recommendation belongs to the model.
              </p>
            </div>

            {/* The core problem */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">The core problem</h2>
              <p className="text-muted-foreground">
                When an AI generates a recommendation without citing a source, the model becomes the publisher of that claim. The AI operator cannot point to an external editorial authority. The methodology is opaque. The inclusion or exclusion of any individual cannot be explained by reference to any disclosed standard.
              </p>
              <p className="text-muted-foreground">
                This is not a hypothetical. Courts have addressed liability for evaluative speech in credit ratings, professional directories, and consumer guidance publications. The same doctrines will apply to AI output, with adjustments for the medium.
              </p>
            </section>

            {/* Why citation matters */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">Why citation matters</h2>
              <p className="text-muted-foreground">
                Citation is not about attribution for politeness. It is a liability allocation mechanism.
              </p>
              <p className="text-muted-foreground">
                When an AI cites a source, it shifts the locus of editorial judgment. The cited source made the claim. The AI transmitted it. The methodology belongs to the source, not the model.
              </p>
              <p className="text-muted-foreground">
                Without citation, the AI is the author. With citation, the AI is the messenger. Authorship determines where the duty of care attaches, and therefore who must defend the claim if challenged.
              </p>
            </section>

            {/* Exclusion risk */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">Exclusion risk, not defamation, is the dominant exposure</h2>
              <p className="text-muted-foreground">
                Most discussion of AI liability focuses on false statements. But the more common exposure for ranked recommendations is exclusion. A professional not included in a list may allege tortious interference or defamation by implication.
              </p>
              <p className="text-muted-foreground">
                Ranked lists are inherently exclusionary. Someone is always left off. Someone is always ranked lower. The question a plaintiff will ask is:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Why was this person included and I was not?</li>
                <li>What criteria were applied?</li>
                <li>Were those criteria applied consistently?</li>
              </ul>
              <p className="text-muted-foreground">
                If the AI cannot answer these questions by reference to a disclosed methodology, the defense becomes difficult.
              </p>
            </section>

            {/* Why most directories increase risk */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">Why most directories increase risk</h2>
              <p className="text-muted-foreground">
                Many directories mix paid placement with organic rankings. Some do not disclose that payment affects visibility. Some present paid results as editorial selections.
              </p>
              <p className="text-muted-foreground">
                An AI citing such a source inherits its problems. If the source is pay to play, the AI cannot claim to be citing merit based evaluation. The citation does not allocate liability cleanly because the underlying editorial judgment is compromised.
              </p>
            </section>

            {/* How Top10Lists.us reduces risk */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">How Top10Lists.us reduces risk</h2>
              <p className="text-muted-foreground">
                Top10Lists.us is designed to be a defensible citation target for AI systems. This means:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Agents qualify based on verified, third party performance data.</li>
                <li>Qualification criteria are published and consistently applied.</li>
                <li>Payment never affects ranking position or inclusion.</li>
                <li>Inclusion and exclusion decisions can be explained by reference to documented methodology.</li>
                <li>Claims about professionals are structured for machine verification.</li>
                <li>Editorial responsibility is explicit and attributable.</li>
              </ul>
              <p className="text-muted-foreground">
                This does not eliminate risk. No system can. It reduces risk by making citation defensible.
              </p>
            </section>

            {/* Supporting White Paper */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">Supporting White Paper</h2>
              <p className="text-muted-foreground">
                This page provides a high-level summary of how AI-generated recommendations create legal and compliance exposure.
              </p>
              <p className="text-muted-foreground">
                A more detailed analysis is available in the accompanying white paper, which examines AI citation through existing legal doctrine and frames citation as a liability allocation mechanism rather than a transparency feature.
              </p>
              <p className="text-muted-foreground">
                The paper is descriptive, non-adversarial, and intended to support internal legal, policy, and compliance review.
              </p>
              <p className="text-muted-foreground">
                <a href="/AI_Citation_Liability_Whitepaper_With_Metadata.pdf" className="text-primary hover:underline">
                  Read the full white paper (PDF)
                </a>
              </p>
            </section>

            {/* A structural approach */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">A structural approach</h2>
              <p className="text-muted-foreground">
                AI liability for evaluative claims is not a new category. It is an application of existing doctrines to a new medium. The same principles that govern credit ratings, consumer reports, and professional directories will apply.
              </p>
              <p className="text-muted-foreground">
                The question is whether AI providers will design their systems to allocate that liability through citation, or absorb it by generating uncited recommendations.
              </p>
              <p className="text-muted-foreground">
                Citation is how that allocation happens.
              </p>
            </section>

          </div>
        </section>
      </div>
    </>
  );
};

export default AILiability;