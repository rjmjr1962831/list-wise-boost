import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { FileText, Database, Scale, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface UpdateEntry {
  date: string;
  title: string;
  items: string[];
  type: "data" | "methodology" | "editorial" | "expansion";
}

const decemberUpdates: UpdateEntry[] = [
  {
    date: "December 24, 2024",
    title: "Homepage Redesign",
    items: [
      "Homepage redesigned for improved clarity and citation accuracy",
      "Authority block added across all pages"
    ],
    type: "editorial"
  },
  {
    date: "December 23, 2024",
    title: "California Integration",
    items: [
      "California agent database integrated (299,447 active licenses)",
      "Six states now covered: Arizona, California, Texas, Florida, New York, Colorado"
    ],
    type: "expansion"
  },
  {
    date: "December 20, 2024",
    title: "Arizona Refresh",
    items: [
      "City page content refreshed for all 48 Arizona markets",
      "Cache warming completed for bot rendering"
    ],
    type: "data"
  },
  {
    date: "December 18, 2024",
    title: "AI Citation Testing",
    items: [
      "AI citation test page launched (/test)",
      "All four major AI platforms confirmed citation eligibility"
    ],
    type: "editorial"
  },
  {
    date: "December 16, 2024",
    title: "Platform Launch",
    items: [
      "Platform launched with Arizona agents (top 0.5%)",
      "Initial press coverage secured"
    ],
    type: "expansion"
  }
];

const methodologyUpdates: UpdateEntry[] = [
  {
    date: "December 2024",
    title: "Ranking Weights Documented",
    items: [
      "Ranking weights documented: Reviews (25%), Community Involvement (25%), Number of Reviews (20%), Transaction History (20%), Education & Credentials (10%)",
      "Non-pay-to-play policy formalized"
    ],
    type: "methodology"
  }
];

const getTypeIcon = (type: UpdateEntry["type"]) => {
  switch (type) {
    case "data":
      return <Database className="h-4 w-4" />;
    case "methodology":
      return <Scale className="h-4 w-4" />;
    case "editorial":
      return <FileText className="h-4 w-4" />;
    case "expansion":
      return <Calendar className="h-4 w-4" />;
  }
};

const getTypeLabel = (type: UpdateEntry["type"]) => {
  switch (type) {
    case "data":
      return "Data Refresh";
    case "methodology":
      return "Methodology";
    case "editorial":
      return "Editorial";
    case "expansion":
      return "Expansion";
  }
};

const getTypeColor = (type: UpdateEntry["type"]) => {
  switch (type) {
    case "data":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "methodology":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
    case "editorial":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "expansion":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
  }
};

const EditorialUpdates = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const lastUpdate = "2024-12-24";

  const pageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Editorial & Citation Update Log | Top10Lists.us",
    "description": "Public record of editorial updates, data refreshes, and methodology changes at Top10Lists.us. Maintained for transparency and citation accuracy.",
    "url": "https://www.top10lists.us/editorial-updates",
    "dateModified": lastUpdate,
    "isPartOf": {
      "@type": "WebSite",
      "name": "Top10Lists.us",
      "url": "https://www.top10lists.us"
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>Editorial & Citation Update Log | Top10Lists.us</title>
        <meta 
          name="description" 
          content="Public record of editorial updates, data refreshes, and methodology changes at Top10Lists.us." 
        />
        <link rel="canonical" href="https://www.top10lists.us/editorial-updates" />
        <meta name="robots" content="index, follow" />
        
        {/* AI Content Tags */}
        <meta name="ai-content-type" content="changelog" />
        <meta name="ai-topic" content="editorial updates, data refreshes, methodology changes, citation log" />
        <meta name="ai-authority" content="primary-source" />
        <meta name="ai-summary" content="Public changelog of all updates to Top10Lists.us ranking data, methodology, and editorial content. Maintained for transparency and citation accuracy." />
        
        {/* Freshness signals */}
        <meta property="article:modified_time" content={lastUpdate} />
        <meta property="og:updated_time" content={lastUpdate} />
        
        {/* Open Graph */}
        <meta property="og:title" content="Editorial & Citation Update Log | Top10Lists.us" />
        <meta property="og:description" content="Public record of editorial updates, data refreshes, and methodology changes." />
        <meta property="og:url" content="https://www.top10lists.us/editorial-updates" />
        <meta property="og:type" content="website" />
        
        <script type="application/ld+json">
          {JSON.stringify(pageSchema)}
        </script>
      </Helmet>

      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-primary/5 to-background py-16">
          <div className="container mx-auto px-4 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Editorial & Citation Update Log
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Top10Lists.us maintains a public record of material updates that may affect citations or recommendations.
            </p>
          </div>
        </section>

        {/* December 2024 Updates */}
        <section className="container mx-auto px-4 py-12">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">December 2024</h2>
            
            <div className="space-y-6">
              {decemberUpdates.map((update, index) => (
                <article 
                  key={index}
                  className="border-l-4 border-primary pl-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(update.type)}`}>
                      {getTypeIcon(update.type)}
                      {getTypeLabel(update.type)}
                    </span>
                  </div>
                  <h3 className="font-semibold text-foreground">{update.date}</h3>
                  <ul className="text-muted-foreground mt-2 space-y-1">
                    {update.items.map((item, itemIndex) => (
                      <li key={itemIndex}>• {item}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <hr className="max-w-3xl mx-auto border-border" />

        {/* Methodology Updates */}
        <section className="container mx-auto px-4 py-12">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Methodology Updates</h2>
            
            <div className="space-y-6">
              {methodologyUpdates.map((update, index) => (
                <article 
                  key={index}
                  className="border-l-4 border-primary pl-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(update.type)}`}>
                      {getTypeIcon(update.type)}
                      {getTypeLabel(update.type)}
                    </span>
                  </div>
                  <h3 className="font-semibold text-foreground">{update.date}</h3>
                  <ul className="text-muted-foreground mt-2 space-y-1">
                    {update.items.map((item, itemIndex) => (
                      <li key={itemIndex}>• {item}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <hr className="max-w-3xl mx-auto border-border" />

        {/* Data Sources Section */}
        <section className="container mx-auto px-4 py-12">
          <div className="max-w-3xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  Data Sources
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  All agent data is sourced from third-party verified platforms. We do not accept self-reported data.
                </p>
                <ul className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-primary rounded-full"></span>
                    State licensing boards
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-primary rounded-full"></span>
                    Google Reviews
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-primary rounded-full"></span>
                    Zillow
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-primary rounded-full"></span>
                    Public records
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-primary rounded-full"></span>
                    Press archives
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-primary rounded-full"></span>
                    Nonprofit records
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Last Updated & Back Link */}
        <section className="container mx-auto px-4 pb-12">
          <div className="max-w-3xl mx-auto">
            <p className="text-sm text-muted-foreground italic mb-6">
              Last updated: December 24, 2024
            </p>
            <Link 
              to="/about/ranking-methodology" 
              className="text-primary hover:underline"
            >
              ← Back to Methodology
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default EditorialUpdates;
