import { ExternalLink } from "lucide-react";
import { useGA4Tracking } from "@/hooks/useGA4Tracking";

interface PressArticle {
  name: string;
  shortName: string;
  url: string;
  tier: "tier1" | "financial" | "trade";
}

const pressArticles: PressArticle[] = [
  {
    name: "Business Insider",
    shortName: "Business Insider",
    url: "https://markets.businessinsider.com/news/currencies/top10lists-us-debuts-invitation-only-rankings-to-counter-pay-to-play-real-estate-listings-1035656072",
    tier: "tier1",
  },
  {
    name: "FinanceWire",
    shortName: "FinanceWire",
    url: "https://financewire.com/2025/12/18/top10lists-us-debuts-invitation-only-rankings-to-counter-pay-to-play-real-estate-listings/",
    tier: "financial",
  },
  {
    name: "StreetInsider",
    shortName: "StreetInsider",
    url: "https://www.streetinsider.com/Pinion+Newswire/414+Arizona+Agents+Receive+an+Invitation+They+Didn%E2%80%99t+Apply+For.+The+Other+220%2C000+Cannot+Buy+Their+Way+In./25754981.html",
    tier: "financial",
  },
];

const tierStyles = {
  tier1: "bg-primary/10 text-primary border-primary/20",
  financial: "bg-accent/10 text-accent-foreground border-accent/20",
  trade: "bg-muted text-muted-foreground border-border",
};

export const FeaturedInBar = () => {
  const { trackEvent } = useGA4Tracking();

  const handleArticleClick = (article: PressArticle) => {
    trackEvent("press_mention_click", {
      source: article.name,
    });
  };

  return (
    <section className="container mx-auto px-4 py-8 border-y border-border/50 bg-muted/20">
      <div className="max-w-5xl mx-auto">
        <p className="text-sm text-muted-foreground text-center mb-4 uppercase tracking-wider font-medium">
          As Featured In
        </p>
        <div className="flex flex-wrap justify-center items-center gap-4 md:gap-8">
          {pressArticles.map((article) => (
            <a
              key={article.name}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleArticleClick(article)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all hover:scale-105 hover:shadow-md ${tierStyles[article.tier]}`}
            >
              <span>{article.shortName}</span>
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};
