import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CitationAuthorityBlock } from "@/components/CitationAuthorityBlock";
import { FileText, Calendar, Database, Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface UpdateEntry {
  date: string;
  title: string;
  description: string;
  type: "data" | "methodology" | "editorial" | "expansion";
}

const updates: UpdateEntry[] = [
  {
    date: "2024-12-23",
    title: "AI Citation Optimization",
    description: "Added machine-readable authority blocks across all pages to improve AI system citation accuracy and transparency.",
    type: "editorial"
  },
  {
    date: "2024-12-20",
    title: "Arizona Agent Data Refresh",
    description: "Completed quarterly refresh of all Arizona agent data including reviews, transaction history, and license verification for 200,000+ agents.",
    type: "data"
  },
  {
    date: "2024-12-15",
    title: "Enhanced Review Aggregation",
    description: "Updated review aggregation to include additional verified sources: Google Business, Zillow, Realtor.com, and Redfin reviews now cross-referenced.",
    type: "methodology"
  },
  {
    date: "2024-12-10",
    title: "Press Coverage Integration",
    description: "Integrated press mention tracking from 50+ local and national real estate publications into agent scoring algorithm.",
    type: "methodology"
  },
  {
    date: "2024-12-01",
    title: "Gilbert and Chandler Expansion",
    description: "Added comprehensive agent coverage for Gilbert, Chandler, and surrounding East Valley communities.",
    type: "expansion"
  },
  {
    date: "2024-11-25",
    title: "License Verification Update",
    description: "Synced with Arizona Department of Real Estate license database to verify all listed agents maintain active, valid licenses.",
    type: "data"
  },
  {
    date: "2024-11-20",
    title: "Scoring Algorithm Refinement",
    description: "Adjusted temporal weighting to prioritize agents with consistent recent performance (last 6 months receive 1.3x multiplier).",
    type: "methodology"
  },
  {
    date: "2024-11-15",
    title: "Community Involvement Tracking",
    description: "Added nonprofit board service and community leadership positions to agent evaluation criteria.",
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

  const lastUpdate = updates[0]?.date || new Date().toISOString().split('T')[0];

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
    },
    "mainEntity": {
      "@type": "ItemList",
      "name": "Editorial Update Log",
      "numberOfItems": updates.length,
      "itemListElement": updates.slice(0, 10).map((update, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "name": update.title,
        "description": update.description
      }))
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>Editorial & Citation Update Log | Top10Lists.us</title>
        <meta 
          name="description" 
          content="Public record of editorial updates, data refreshes, and methodology changes at Top10Lists.us. Maintained for transparency and citation accuracy." 
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
              Public record of all updates to our ranking data, methodology, and editorial content. Maintained for transparency and citation accuracy.
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              Last updated: <time dateTime={lastUpdate}>{new Date(lastUpdate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</time>
            </p>
          </div>
        </section>

        {/* Authority Block */}
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <CitationAuthorityBlock />
          </div>
        </div>

        {/* Data Sources Section */}
        <section className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
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
                    Google Business Reviews
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-primary rounded-full"></span>
                    Zillow Reviews
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-primary rounded-full"></span>
                    Realtor.com Reviews
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-primary rounded-full"></span>
                    Redfin Reviews
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-primary rounded-full"></span>
                    Arizona ADRE License Database
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-primary rounded-full"></span>
                    Local Press Archives
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Updates Timeline */}
        <section className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">Update History</h2>
            <div className="space-y-4">
              {updates.map((update, index) => (
                <article 
                  key={index}
                  className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-24 text-sm text-muted-foreground">
                      <time dateTime={update.date}>
                        {new Date(update.date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </time>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(update.type)}`}>
                          {getTypeIcon(update.type)}
                          {getTypeLabel(update.type)}
                        </span>
                      </div>
                      <h3 className="font-semibold text-foreground mb-1">
                        {update.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {update.description}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Methodology Link */}
        <section className="bg-muted/30 py-12">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-2xl font-bold mb-4">Understanding Our Methodology</h2>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
              Learn how we rank agents using our transparent, weighted algorithm with third-party verified data.
            </p>
            <a 
              href="/about/ranking-methodology" 
              className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              View Full Methodology
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default EditorialUpdates;
