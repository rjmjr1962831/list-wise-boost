import { Shield, Star, Newspaper, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { useGA4Tracking } from "@/hooks/useGA4Tracking";

const reviewPlatforms = [
  { name: "Google Reviews", url: "https://google.com" },
  { name: "Redfin", url: "https://redfin.com" },
  { name: "Realtor.com", url: "https://realtor.com" },
  { name: "Yelp", url: "https://yelp.com" },
  { name: "Zillow", url: "https://zillow.com" }
];

const pressOutlets = [
  { name: "Wall Street Journal", url: "https://wsj.com" },
  { name: "New York Times", url: "https://nytimes.com" },
  { name: "Forbes", url: "https://forbes.com" },
  { name: "CNBC", url: "https://cnbc.com" },
  { name: "Yahoo! Finance", url: "https://finance.yahoo.com" },
  { name: "Fox News", url: "https://foxnews.com" },
  { name: "ABC News", url: "https://abcnews.go.com" },
  { name: "CNN", url: "https://cnn.com" },
  { name: "NBC Today", url: "https://today.com" },
  { name: "Bloomberg", url: "https://bloomberg.com" },
  { name: "USA Today", url: "https://usatoday.com" },
  { name: "Phoenix Business Journal", url: "https://bizjournals.com/phoenix" },
  { name: "Arizona Republic", url: "https://azcentral.com" }
];

export const AuthorityLinks = () => {
  const { trackEvent } = useGA4Tracking();

  const handleLinkClick = (sourceName: string, sourceType: string) => {
    trackEvent('authority_link_click', {
      source: sourceName,
      category: sourceType,
      page_path: '/'
    });
  };

  return (
    <section className="container mx-auto px-4 py-16">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            How We Rank Agents
          </h2>
          <p className="text-muted-foreground text-lg">
            We analyze data from multiple authoritative sources to identify top performers
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Government Records */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold">Government Records</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                We verify through official state records:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 mb-4">
                <li>• License verification</li>
                <li>• Years in business</li>
                <li>• Reputation (adverse actions)</li>
              </ul>
              <a
                href="https://services.azre.gov/publicdatabase/searchlicensee.aspx"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
                onClick={() => handleLinkClick('AZDRE', 'government')}
              >
                Arizona Dept. of Real Estate <ExternalLink className="h-3 w-3" />
              </a>
            </CardContent>
          </Card>

          {/* Review Platforms */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Star className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold">Review Platforms</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Ratings aggregated from major review platforms.
              </p>
              <div className="flex flex-wrap gap-2">
                {reviewPlatforms.map((platform) => (
                  <span
                    key={platform.name}
                    className="text-xs bg-muted px-2 py-1 rounded"
                  >
                    {platform.name}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Press Coverage */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Newspaper className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold">Press Coverage</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Agents featured in major outlets receive ranking credit.
              </p>
              <div className="flex flex-wrap gap-1">
                {pressOutlets.slice(0, 6).map((outlet) => (
                  <span
                    key={outlet.name}
                    className="text-xs bg-muted px-2 py-1 rounded"
                  >
                    {outlet.name}
                  </span>
                ))}
                <span className="text-xs text-muted-foreground px-2 py-1">
                  +{pressOutlets.length - 6} more
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Methodology Link */}
        <div className="text-center mt-8">
          <Link 
            to="/ranking-methodology" 
            className="text-primary hover:underline text-sm font-medium"
            onClick={() => handleLinkClick('methodology', 'internal')}
          >
            Read our full ranking methodology →
          </Link>
        </div>
      </div>
    </section>
  );
};
