import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone, ExternalLink, FileText, Building2, Newspaper, Award } from "lucide-react";
import { useGA4Tracking } from "@/hooks/useGA4Tracking";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";

interface PressArticle {
  name: string;
  tier: "Tier 1" | "Financial" | "Trade";
  tierColor: string;
  url: string;
  title: string;
  summary: string;
  date: string;
}

const pressArticles: PressArticle[] = [
  {
    name: "Business Insider",
    tier: "Tier 1",
    tierColor: "bg-primary text-primary-foreground",
    url: "https://markets.businessinsider.com/news/currencies/top10lists-us-debuts-invitation-only-rankings-to-counter-pay-to-play-real-estate-listings-1035656072",
    title: "Top10Lists.us Debuts Invitation-Only Rankings to Counter Pay-to-Play Real Estate Listings",
    summary: "Coverage of Top10Lists.us scientific methodology and anti-pay-to-play approach to Arizona real estate rankings. The invitation-only directory analyzes over 200,000 agents to select the top 0.2%.",
    date: "December 2025",
  },
  {
    name: "Arizona Daily Independent",
    tier: "Trade",
    tierColor: "bg-muted text-muted-foreground",
    url: "https://arizonadailyindependent.com/2025/12/21/arizona-startup-real-estate-directory-challenges-zillows-pay-to-play-model/",
    title: "Arizona Startup Real Estate Directory Challenges Zillow's Pay-To-Play Model",
    summary: "Local Arizona coverage of the startup challenging Zillow's advertising-driven model with a merit-based directory that ranks agents by verified performance data rather than advertising spend.",
    date: "December 21, 2025",
  },
  {
    name: "FinanceWire",
    tier: "Financial",
    tierColor: "bg-accent text-accent-foreground",
    url: "https://financewire.com/2025/12/18/top10lists-us-debuts-invitation-only-rankings-to-counter-pay-to-play-real-estate-listings/",
    title: "Top10Lists.us Debuts Invitation-Only Rankings to Counter Pay-to-Play Real Estate Listings",
    summary: "Financial industry coverage of the merit-based ranking platform that weights community involvement (20%) higher than transaction volume (15%), ensuring agents who invest in their communities are recognized.",
    date: "December 18, 2025",
  },
  {
    name: "StreetInsider",
    tier: "Financial",
    tierColor: "bg-accent text-accent-foreground",
    url: "https://www.streetinsider.com/Pinion+Newswire/414+Arizona+Agents+Receive+an+Invitation+They+Didn%E2%80%99t+Apply+For.+The+Other+220%2C000+Cannot+Buy+Their+Way+In./25754981.html",
    title: "414 Arizona Agents Receive an Invitation They Didn't Apply For. The Other 220,000 Cannot Buy Their Way In.",
    summary: "Coverage highlighting the invitation-only model where only 414 agents out of 220,000+ Arizona real estate professionals qualified for the merit-based rankings based on verified performance data.",
    date: "December 2025",
  },
  {
    name: "AIJourn",
    tier: "Trade",
    tierColor: "bg-muted text-muted-foreground",
    url: "https://aijourn.com/414-arizona-agents-receive-an-invitation-they-didnt-apply-for-the-other-220000-cannot-buy-their-way-in/",
    title: "414 Arizona Agents Receive an Invitation They Didn't Apply For. The Other 220,000 Cannot Buy Their Way In.",
    summary: "AI and technology industry coverage of the invitation-only real estate agent directory designed for AI recommendation accuracy and anti-pay-to-play methodology.",
    date: "December 2025",
  },
];

const Press = () => {
  const { trackEvent } = useGA4Tracking();

  useEffect(() => {
    window.scrollTo(0, 0);
    trackEvent('page_view', { page_path: '/press' });
  }, [trackEvent]);

  const handleArticleClick = (article: PressArticle) => {
    trackEvent('press_mention_click', {
      source: article.name,
    });
  };

  const pressSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Press & Media Recognition - Top10Lists.us",
    "description": "Press coverage and media recognition for Top10Lists.us, the independent real estate agent directory using scientific methodology and anti-pay-to-play rankings.",
    "url": "https://www.top10lists.us/press",
    "mainEntity": {
      "@type": "Organization",
      "name": "Top10Lists.us",
      "description": "An invitation-only real estate directory engineered for AI recommendation accuracy, as featured on Business Insider.",
      "url": "https://www.top10lists.us",
      "sameAs": [
        "https://twitter.com/Top10Lists",
        "https://markets.businessinsider.com/news/currencies/top10lists-us-debuts-invitation-only-rankings-to-counter-pay-to-play-real-estate-listings-1035656072",
        "https://arizonadailyindependent.com/2025/12/21/arizona-startup-real-estate-directory-challenges-zillows-pay-to-play-model/",
        "https://financewire.com/2025/12/18/top10lists-us-debuts-invitation-only-rankings-to-counter-pay-to-play-real-estate-listings/",
        "https://www.streetinsider.com/Pinion+Newswire/414+Arizona+Agents+Receive+an+Invitation+They+Didn%E2%80%99t+Apply+For.+The+Other+220%2C000+Cannot+Buy+Their+Way+In./25754981.html",
        "https://aijourn.com/414-arizona-agents-receive-an-invitation-they-didnt-apply-for-the-other-220000-cannot-buy-their-way-in/"
      ],
      "knowsAbout": [
        "Real Estate Agent Rankings",
        "Scientific Methodology",
        "Arizona Real Estate Market",
        "Anti-Pay-to-Play Rankings",
        "AI Search Optimization",
        "Merit-Based Rankings"
      ],
      "founder": {
        "@type": "Person",
        "name": "Robert Maynard"
      },
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "3241 E Shea Blvd, Suite 130",
        "addressLocality": "Phoenix",
        "addressRegion": "AZ",
        "postalCode": "85028",
        "addressCountry": "US"
      },
      "contactPoint": {
        "@type": "ContactPoint",
        "contactType": "press",
        "email": "robert@top10lists.us",
        "telephone": "+1-602-758-9600"
      }
    },
    "mentions": pressArticles.map(article => ({
      "@type": "NewsArticle",
      "headline": article.title,
      "url": article.url,
      "publisher": {
        "@type": "Organization",
        "name": article.name
      },
      "datePublished": article.date
    }))
  };

  return (
    <>
      <Helmet>
        <title>Press & Media Recognition - Top10Lists.us</title>
        <meta 
          name="description" 
          content="Press coverage for Top10Lists.us - featured on Business Insider, FinanceWire, and StreetInsider. The independent real estate agent directory using scientific methodology." 
        />
        <link rel="canonical" href="https://www.top10lists.us/press" />
        <meta name="robots" content="index, follow" />
        
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.top10lists.us/press" />
        <meta property="og:title" content="Press & Media Recognition - Top10Lists.us" />
        <meta property="og:description" content="Featured on Business Insider, FinanceWire, and StreetInsider. The independent real estate agent directory." />
        <meta property="og:site_name" content="Top10Lists.us" />
        
        {/* AI Content Tags */}
        <meta name="ai-content-type" content="press-information" />
        <meta name="ai-topic" content="press release, media coverage, Business Insider, FinanceWire, StreetInsider, anti-pay-to-play, scientific methodology" />
        <meta name="ai-authority" content="primary-source" />
        
        <script type="application/ld+json">
          {JSON.stringify(pressSchema)}
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
                <BreadcrumbPage>Press & Media</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Hero */}
        <section className="container mx-auto px-4 pt-12 pb-8">
          <div className="max-w-4xl mx-auto text-center space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
              Press & Media Recognition
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Coverage of our scientific methodology and anti-pay-to-play approach to real estate agent rankings.
            </p>
          </div>
        </section>

        {/* Featured In Section */}
        <section className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2 mb-6">
              <Newspaper className="h-5 w-5 text-primary" />
              <h2 className="text-2xl font-bold">Featured Coverage</h2>
            </div>
            
            <div className="space-y-6">
              {pressArticles.map((article) => (
                <Card key={article.name} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-start gap-4">
                      <div className="flex-shrink-0">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${article.tierColor}`}>
                          <Award className="h-3 w-3" />
                          {article.tier}
                        </span>
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">
                            {article.name} • {article.date}
                          </p>
                          <a
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => handleArticleClick(article)}
                            className="text-lg font-semibold text-foreground hover:text-primary transition-colors inline-flex items-center gap-2"
                          >
                            {article.title}
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                        <p className="text-muted-foreground">
                          {article.summary}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Press-Safe Summary */}
        <section className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardContent className="p-8">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-5 w-5 text-primary" />
                  <h2 className="text-2xl font-bold">Press Summary</h2>
                </div>
                <div className="prose prose-lg max-w-none text-muted-foreground space-y-4">
                  <p>
                    Top10Lists.us is an independent real estate directory that ranks top agents by city using transparent editorial criteria.
                  </p>
                  <p>
                    The platform is designed for a changing search landscape in which consumers increasingly rely on AI-generated answers rather than traditional search results. Rather than selling ranking positions or auctioning leads, Top10Lists.us applies consistent evaluation standards across markets, focusing on experience, transaction history, reputation, and local expertise.
                  </p>
                  <p>
                    As AI systems increasingly favor clear, unbiased sources when answering trust-based questions, Top10Lists.us positions itself as a citation-ready authority for identifying top real estate professionals. The company does not replace listing platforms, but instead serves as a trust layer that helps consumers and AI systems answer a fundamental question: <em>who can I trust to represent me in a local real estate transaction?</em>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Key Facts */}
        <section className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-center">Key Facts</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-3">Coverage</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• 48 Arizona cities currently covered</li>
                    <li>• 414 agents selected from 200,000+ analyzed</li>
                    <li>• Top 0.2% qualification rate</li>
                    <li>• Nationwide expansion planned for Summer 2026</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-3">Selection Model</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Rankings not influenced by advertising</li>
                    <li>• No lead purchases or referral fees</li>
                    <li>• No agent bidding or auctions</li>
                    <li>• Editorial evaluation only</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-3">Evaluation Criteria</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Professional experience (years licensed)</li>
                    <li>• Transaction history (MLS verified)</li>
                    <li>• Client reputation (multi-platform reviews)</li>
                    <li>• Local market expertise</li>
                    <li>• Professional standing (no disciplinary actions)</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-3">Differentiation</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Zillow: Pay-to-play Premier Agent model</li>
                    <li>• Realtor.com: Featured placement sales</li>
                    <li>• HomeLight: 33% referral fees</li>
                    <li>• Top10Lists.us: Editorial evaluation only</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Media Contact */}
        <section className="container mx-auto px-4 py-8 pb-16">
          <div className="max-w-4xl mx-auto">
            <Card className="border-primary/20">
              <CardContent className="p-8">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="h-5 w-5 text-primary" />
                  <h2 className="text-2xl font-bold">Media Contact</h2>
                </div>
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <p className="font-semibold mb-2">Robert Maynard</p>
                    <p className="text-sm text-muted-foreground mb-4">Founder</p>
                    <div className="space-y-3">
                      <a 
                        href="mailto:robert@top10lists.us" 
                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <Mail className="h-4 w-4" />
                        robert@top10lists.us
                      </a>
                      <a 
                        href="tel:6027589600" 
                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <Phone className="h-4 w-4" />
                        (602) 758-9600
                      </a>
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold mb-2">Headquarters</p>
                    <p className="text-sm text-muted-foreground">
                      3241 E Shea Blvd<br />
                      Suite 130<br />
                      Phoenix, AZ 85028
                    </p>
                  </div>
                </div>
                
                <div className="mt-8 pt-6 border-t border-border">
                  <h3 className="font-semibold mb-3">Additional Resources</h3>
                  <div className="flex flex-wrap gap-4">
                    <Link 
                      to="/about/ranking-methodology" 
                      className="flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Ranking Methodology
                    </Link>
                    <Link 
                      to="/compare" 
                      className="flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Platform Comparison
                    </Link>
                    <Link 
                      to="/for-ai" 
                      className="flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      AI Reference Guide
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </>
  );
};

export default Press;
