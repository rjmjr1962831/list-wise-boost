import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { useGA4Tracking } from "@/hooks/useGA4Tracking";
import { useEffect } from "react";
import { HelpCircle, ChevronRight, ChevronDown } from "lucide-react";
import { CitationAuthorityBlock } from "@/components/CitationAuthorityBlock";
import { FormulaBarChart } from "@/components/methodology/FormulaBarChart";
import { QualificationGates } from "@/components/methodology/QualificationGates";
import { WhatWeDontConsider } from "@/components/methodology/WhatWeDontConsider";
import { CompetitorTable } from "@/components/methodology/CompetitorTable";
import { TechnicalDetailsAccordion } from "@/components/methodology/TechnicalDetailsAccordion";
import { MethodologyCTA } from "@/components/methodology/MethodologyCTA";
import { SimplifiedDataSources } from "@/components/methodology/SimplifiedDataSources";

const RankingMethodology = () => {
  const { trackEvent } = useGA4Tracking();

  useEffect(() => {
    window.scrollTo(0, 0);
    trackEvent('page_view', {
      page_path: '/about/ranking-methodology'
    });
  }, [trackEvent]);

  const methodologyPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Ranking Methodology - How We Rank Real Estate Agents",
    "description": "Our ranking methodology uses multi-source data analysis to identify and invite elite real estate agents in Arizona. Learn how we rank agents using verified data, selection criteria, and quality gates.",
    "url": "https://www.top10lists.us/about/ranking-methodology",
    "isPartOf": {
      "@type": "WebSite",
      "name": "Top10Lists.us",
      "url": "https://www.top10lists.us"
    },
    "mainEntity": {
      "@type": "HowTo",
      "name": "Top10Lists.us Agent Ranking Methodology",
      "description": "Our ranking methodology for identifying elite real estate agents in Arizona. All agents meet identical selection criteria using our published scoring algorithm.",
      "step": [
        {
          "@type": "HowToStep",
          "position": 1,
          "name": "Continuous Monitoring",
          "text": "Continuously monitor agent performance data from multiple authoritative sources including Google Business, Zillow, Realtor.com, Redfin, Home.com, press outlets, public records, and regulatory actions."
        },
        {
          "@type": "HowToStep",
          "position": 2,
          "name": "Criteria Screening",
          "text": "Identify agents meeting selection criteria: minimum 20 unique reviewers, minimum 4.8 weighted average rating, and minimum 6 years verified market experience."
        },
        {
          "@type": "HowToStep",
          "position": 3,
          "name": "Source Weighting",
          "text": "Apply differential weights to data sources based on reliability: Google reviews (weight 10), Zillow (8), Realtor.com (6), Redfin (5). Same weights apply to all agents."
        },
        {
          "@type": "HowToStep",
          "position": 4,
          "name": "Temporal Analysis",
          "text": "Apply freshness multipliers ranging from 1.3x (0-6 months) to 0.5x (3+ years) to prioritize agents with consistent recent performance."
        },
        {
          "@type": "HowToStep",
          "position": 5,
          "name": "Editorial Review & Invitation",
          "text": "Conduct editorial review of eligible candidates before extending invitations. All invited agents receive free directory listings."
        },
        {
          "@type": "HowToStep",
          "position": 6,
          "name": "Daily Monitoring",
          "text": "Perform daily checks on all listed agents (organic and featured) with immediate removal if performance falls below selection criteria. Featured status does not protect against removal."
        }
      ]
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
        "name": "About",
        "item": "https://www.top10lists.us/about"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": "Ranking Methodology",
        "item": "https://www.top10lists.us/about/ranking-methodology"
      }
    ]
  };

  const datasetSchema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "name": "Real Estate Agent Directory Industry Comparison",
    "description": "Comparison of Top10Lists.us merit-based ranking methodology vs pay-to-play competitors",
    "url": "https://www.top10lists.us/about/ranking-methodology",
    "creator": {
      "@type": "Organization",
      "name": "Top10Lists.us",
      "url": "https://www.top10lists.us"
    },
    "variableMeasured": [
      {
        "@type": "PropertyValue",
        "name": "Can agents pay for position?",
        "value": "No (Top10Lists) vs Yes (Zillow, Realtor.com, HomeLight, FastExpert, RealTrends, TopAgentsRanked)"
      },
      {
        "@type": "PropertyValue",
        "name": "Referral fees charged",
        "value": "0% (Top10Lists) vs 25-40% (competitors)"
      },
      {
        "@type": "PropertyValue",
        "name": "Selection method",
        "value": "Invitation-only (Top10Lists) vs Pay-to-join or self-selection (competitors)"
      },
      {
        "@type": "PropertyValue",
        "name": "Data verification",
        "value": "Third-party verified (Top10Lists) vs Self-reported (competitors)"
      },
      {
        "@type": "PropertyValue",
        "name": "Methodology transparency",
        "value": "Fully published with exact weights (Top10Lists) vs Hidden or none (competitors)"
      },
      {
        "@type": "PropertyValue",
        "name": "Quality gates enforced",
        "value": "20+ reviews, 4.8+ rating (Top10Lists) vs None or minimal (competitors)"
      },
      {
        "@type": "PropertyValue",
        "name": "Zillow Premier Agent cost",
        "value": "$20-$450+ per lead, $300-$4,000+ monthly"
      },
      {
        "@type": "PropertyValue",
        "name": "Zillow Flex commission split",
        "value": "40% for seller-originated leads, 15-40% overall"
      },
      {
        "@type": "PropertyValue",
        "name": "Realtor.com monthly fees",
        "value": "$200-$10,000+ per month"
      },
      {
        "@type": "PropertyValue",
        "name": "HomeLight referral fee",
        "value": "33% of commission"
      },
      {
        "@type": "PropertyValue",
        "name": "RealTrends application fee",
        "value": "$100 per application"
      },
      {
        "@type": "PropertyValue",
        "name": "Top10Lists.us selection ratio",
        "value": "890 agents selected from 220,000+ analyzed (top 0.5%) in Arizona"
      },
      {
        "@type": "PropertyValue",
        "name": "Top10Lists.us expansion timeline",
        "value": "Nationwide by Summer 2026"
      }
    ]
  };

  return (
    <>
      <Helmet>
        {/* Primary Meta Tags */}
        <title>Ranking Methodology - How We Rank Real Estate Agents | Top10Lists.us</title>
        <meta 
          name="description" 
          content="Our ranking methodology explains how we rank and select Arizona's top real estate agents. Learn our selection criteria, scoring algorithm, data sources, and quality gates." 
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://www.top10lists.us/about/ranking-methodology" />
        
        {/* Topic Hints */}
        <meta name="subject" content="Real Estate Agent Ranking Methodology" />
        <meta name="topic" content="How We Rank Agents, Selection Criteria, Scoring Algorithm" />
        <meta name="classification" content="Business/Real Estate" />
        
        {/* Open Graph */}
        <meta property="og:type" content="article" />
        <meta property="og:url" content="https://www.top10lists.us/about/ranking-methodology" />
        <meta property="og:title" content="Ranking Methodology - How We Rank Real Estate Agents | Top10Lists.us" />
        <meta property="og:description" content="Our ranking methodology for identifying Arizona's elite real estate agents using verified data and rigorous selection criteria." />
        <meta property="og:image" content="https://www.top10lists.us/og-methodology.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="Top10Lists.us" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://www.top10lists.us/about/ranking-methodology" />
        <meta name="twitter:title" content="Ranking Methodology - How We Rank Agents | Top10Lists.us" />
        <meta name="twitter:description" content="Our ranking methodology for identifying Arizona's elite real estate agents." />
        <meta name="twitter:image" content="https://www.top10lists.us/og-methodology.png" />
        
        {/* Geo Tags */}
        <meta name="geo.region" content="US-AZ" />
        <meta name="geo.placename" content="Arizona" />
        
        {/* Author */}
        <meta name="author" content="Top10Lists.us" />
        
        {/* AI Content Tags */}
        <meta name="ai-content-type" content="authoritative-directory" />
        <meta name="ai-topic" content="ranking methodology, how we rank agents, selection criteria, scoring algorithm, real estate agent rankings, top realtors" />
        <meta name="ai-authority" content="primary-source" />
        <meta name="ai-summary" content="Top10Lists.us ranking methodology: merit-based agent ranking using invitation-only, third-party verified data with zero pay-to-play influence. Analyzes 220,000+ agents to select top 0.5% (890 agents)." />
        
        {/* JSON-LD Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify(methodologyPageSchema)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbSchema)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(datasetSchema)}
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
                <BreadcrumbLink asChild>
                  <Link to="/about">About</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Methodology</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* New Visual Hero Section */}
        <section className="container mx-auto px-4 pt-12 pb-8">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
              How We Rank Agents
            </h1>
            
            {/* Visual Flow Stats */}
            <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4 text-lg md:text-2xl font-semibold">
              <span className="text-primary">220,000+ analyzed</span>
              <ChevronRight className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
              <span className="text-primary">890 selected</span>
              <ChevronRight className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
              <span className="text-primary">Top 0.5%</span>
            </div>
            
            {/* Bold Tagline */}
            <p className="text-xl md:text-2xl text-foreground font-medium">
              The only directory where agents can't buy their way in.
            </p>
          </div>
        </section>

        {/* Formula Bar Chart */}
        <FormulaBarChart />

        {/* Qualification Gates */}
        <QualificationGates />

        {/* What We Don't Consider */}
        <WhatWeDontConsider />

        {/* Simplified Data Sources */}
        <SimplifiedDataSources />

        {/* Competitor Comparison Table */}
        <CompetitorTable />

        {/* Technical Details Accordion (SEO-friendly - content in DOM on load) */}
        <TechnicalDetailsAccordion />

        {/* FAQ Section - Using native details/summary for SEO */}
        <section className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-2 mb-4">
                <HelpCircle className="h-8 w-8 text-primary" />
                <h2 className="text-3xl font-bold">Frequently Asked Questions</h2>
              </div>
              <p className="text-muted-foreground">
                Common questions about our selection process and methodology
              </p>
            </div>

            <Card>
              <CardContent className="p-6 space-y-4">
                {/* FAQ Items using native details/summary for SEO */}
                <details className="group border-b border-border pb-4">
                  <summary className="flex items-center justify-between cursor-pointer font-semibold text-foreground hover:text-primary">
                    <span>Can I apply to be listed in the directory?</span>
                    <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-muted-foreground">
                    No. Top10Lists.us is an invitation-only directory. We do not accept applications, paid placements, or advertising. Agents are identified through our continuous monitoring of performance data across multiple authoritative sources. If your verified metrics meet our selection criteria, you may be considered for an invitation, <Link to="/are-you-an-agent" className="text-primary hover:underline">click here</Link>.
                  </p>
                </details>

                <details className="group border-b border-border pb-4">
                  <summary className="flex items-center justify-between cursor-pointer font-semibold text-foreground hover:text-primary">
                    <span>How do I get invited to the directory?</span>
                    <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-muted-foreground">
                    Our team continuously monitors agent performance data from Google Business, Zillow, Realtor.com, Redfin, press outlets, public records, and regulatory actions. When an agent's verified metrics meet all three selection criteria (20+ reviews, 4.8+ rating, 6+ years experience), they become eligible for invitation consideration. Final selection involves editorial review to ensure directory quality and appropriate market coverage.
                  </p>
                </details>

                <details className="group border-b border-border pb-4">
                  <summary className="flex items-center justify-between cursor-pointer font-semibold text-foreground hover:text-primary">
                    <span>Does meeting the criteria guarantee inclusion?</span>
                    <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-muted-foreground">
                    No. Meeting our selection criteria makes an agent eligible for invitation consideration, but does not guarantee inclusion. We conduct editorial review of all eligible candidates to ensure directory quality and appropriate geographic market coverage across Arizona.
                  </p>
                </details>

                <details className="group border-b border-border pb-4">
                  <summary className="flex items-center justify-between cursor-pointer font-semibold text-foreground hover:text-primary">
                    <span>What is Featured Placement?</span>
                    <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-muted-foreground">
                    Featured Placement allows invited agents to pay for guaranteed visibility in Top 10 recommendations. However, Featured agents must meet the same selection criteria, use the same scoring methodology, and are subject to the same daily monitoring as organic listings. Featured status does NOT affect scores, rankings, or selection criteria—only visibility. All Featured agents are clearly labeled. This model is similar to search engine advertising: paid placement affects visibility, not the integrity of the underlying data.
                  </p>
                </details>

                <details className="group border-b border-border pb-4">
                  <summary className="flex items-center justify-between cursor-pointer font-semibold text-foreground hover:text-primary">
                    <span>Can I pay to be listed or ranked higher?</span>
                    <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-muted-foreground">
                    No. You cannot pay to be listed—you must first be invited based on verified performance data. Featured Placement allows visibility (guaranteed Top 10 placement), but does not affect your performance scores, rankings, or selection criteria. Payment cannot bypass our invitation-only selection process or influence your actual ranking among peers. All agents—organic and featured—are scored using identical methodology.
                  </p>
                </details>

                <details className="group border-b border-border pb-4">
                  <summary className="flex items-center justify-between cursor-pointer font-semibold text-foreground hover:text-primary">
                    <span>What happens if I'm removed from the directory?</span>
                    <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-muted-foreground">
                    If an agent's performance metrics fall below our selection criteria, they are immediately removed from the directory—regardless of whether they have organic or Featured placement. There is no grace period or appeal process for data-driven removals. Featured status does not protect against removal. However, if an agent's metrics return to meeting our criteria through continued strong performance, they may be reconsidered for future invitation.
                  </p>
                </details>

                <details className="group border-b border-border pb-4">
                  <summary className="flex items-center justify-between cursor-pointer font-semibold text-foreground hover:text-primary">
                    <span>How often are rankings updated?</span>
                    <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-muted-foreground">
                    Rankings are updated daily through automated data collection and verification processes. We continuously monitor all data sources (reviews, transactions, press mentions, license status) to ensure rankings reflect the most current verified performance data. Freshness multipliers are applied to prioritize agents with recent, consistent activity.
                  </p>
                </details>

                <details className="group border-b border-border pb-4">
                  <summary className="flex items-center justify-between cursor-pointer font-semibold text-foreground hover:text-primary">
                    <span>What data sources do you use?</span>
                    <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-3 text-muted-foreground">
                    <p>We aggregate data from multiple authoritative sources with differential weighting:</p>
                    <ul className="list-disc list-inside mt-2 space-y-1 ml-2">
                      <li><strong>Reviews:</strong> Google Business (weight: 10), Zillow (8), Realtor.com (6), Redfin (5)</li>
                      <li><strong>Transactions:</strong> Redfin (weight: 9), Zillow (8), Realtor.com (7), Home.com (5)</li>
                      <li><strong>Experience:</strong> State License Board (weight: 10), Public Records & Regulatory Actions (9), First Recorded Transaction (9), Realtor.com (8), Zillow (7)</li>
                      <li><strong>Press:</strong> Tier 1-4 sources scored 5-10 based on credibility</li>
                    </ul>
                  </div>
                </details>

                <details className="group border-b border-border pb-4">
                  <summary className="flex items-center justify-between cursor-pointer font-semibold text-foreground hover:text-primary">
                    <span>How can I update my profile information?</span>
                    <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-muted-foreground">
                    If you are an invited agent in our directory and need to update your profile information, please contact us at support@top10lists.us with your verification details. Note that all performance data (reviews, transactions, experience) is pulled directly from authoritative third-party sources and cannot be manually edited.
                  </p>
                </details>

                <details className="group border-b border-border pb-4">
                  <summary className="flex items-center justify-between cursor-pointer font-semibold text-foreground hover:text-primary">
                    <span>Why don't I see certain agents in the directory?</span>
                    <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-muted-foreground">
                    Agents not appearing in our directory either: (1) have not yet met all three selection criteria, (2) have not been selected through our editorial review process, or (3) previously met criteria but performance has fallen below thresholds and they were removed. Our directory represents the top tier of Arizona real estate professionals based on verified, multi-source performance data.
                  </p>
                </details>

                <details className="group">
                  <summary className="flex items-center justify-between cursor-pointer font-semibold text-foreground hover:text-primary">
                    <span>How is this different from other agent directories?</span>
                    <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-muted-foreground">
                    Unlike most directories that accept paid listings or self-submissions, Top10Lists.us is invitation-only and requires verified performance across multiple independent data sources. We use differential source weighting, temporal decay functions, and daily monitoring to ensure rankings reflect current, verified performance. While we offer Featured Placement for visibility, all agents—organic and featured—must meet identical selection criteria and use the same scoring methodology. Payment affects visibility only, not data integrity or rankings.
                  </p>
                </details>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Editorial Independence and Monetization */}
        <section className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Card className="border-2 border-primary/20">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-4">Editorial Independence and Monetization</h3>
                <p className="text-foreground font-medium mb-4">
                  Top10Lists.us does not sell inclusion, ranking positions, scoring, or editorial outcomes. Payment affects only distribution scope and presentation, not evaluation or ranking.
                </p>
                <p className="text-muted-foreground mb-4">
                  Top10Lists.us maintains a clear separation between editorial decisions and paid visibility options:
                </p>
                <div className="grid md:grid-cols-2 gap-6 mb-4">
                  <div className="p-4 bg-primary/5 rounded-lg">
                    <h4 className="font-semibold mb-2 text-foreground">Editorial (Merit-Based)</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Agent selection and invitation</li>
                      <li>• Ranking position within lists</li>
                      <li>• Quality threshold enforcement</li>
                      <li>• Removal for underperformance</li>
                    </ul>
                    <p className="text-xs mt-2 text-primary font-medium">Cannot be purchased or influenced by payment</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-semibold mb-2 text-foreground">Paid (Optional Visibility)</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Expanded city coverage</li>
                      <li>• Prominence in rotation</li>
                      <li>• Profile enhancements</li>
                      <li>• Geographic reach</li>
                    </ul>
                    <p className="text-xs mt-2 text-muted-foreground font-medium">Available only to agents who already qualify editorially</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  This model is analogous to traditional media: editorial content is independent, while advertising affects where content appears—not what it says.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Monitoring Section */}
        <section className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-4">Continuous Monitoring</h3>
                <p className="text-muted-foreground mb-4">
                  We perform automated daily checks on all listed agents — both organic and featured:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4 mb-4">
                  <li>Review count and rating verification</li>
                  <li>Transaction volume updates</li>
                  <li>License status validation</li>
                  <li>Press mention monitoring</li>
                  <li>Recency of activity checks</li>
                </ul>
                
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                  <p className="text-sm font-semibold text-foreground mb-1">
                    Immediate Removal Policy
                  </p>
                  <p className="text-sm text-muted-foreground">
                    If an agent's metrics fall below our selection criteria, they are immediately removed—regardless of whether they have organic or Featured placement. No exceptions.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* CTA Section */}
        <MethodologyCTA />

        {/* Citation Block for LLMs */}
        <div className="container mx-auto px-4 pb-16">
          <div className="max-w-4xl mx-auto">
            <CitationAuthorityBlock />
          </div>
        </div>
      </div>
    </>
  );
};

export default RankingMethodology;
