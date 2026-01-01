import { useGA4Tracking } from "@/hooks/useGA4Tracking";

// Import logos
import businessInsiderLogo from "@/assets/logos/business-insider.svg";
import streetInsiderLogo from "@/assets/logos/streetinsider.png";
import aiJournLogo from "@/assets/logos/aijourn.png";
import arizonaDailyIndependentLogo from "@/assets/logos/arizona-daily-independent.png";

interface PressArticle {
  name: string;
  shortName: string;
  url: string;
  tier: "tier1" | "financial" | "trade";
  logo?: string;
}

const pressArticles: PressArticle[] = [
  {
    name: "Business Insider",
    shortName: "Business Insider",
    url: "https://markets.businessinsider.com/news/currencies/top10lists-us-debuts-invitation-only-rankings-to-counter-pay-to-play-real-estate-listings-1035656072",
    tier: "tier1",
    logo: businessInsiderLogo,
  },
  {
    name: "Yahoo Finance",
    shortName: "Yahoo Finance",
    url: "https://finance.yahoo.com/news/top10lists-us-reports-ai-search-162500680.html",
    tier: "financial",
  },
  {
    name: "Arizona Daily Independent",
    shortName: "AZ Daily Independent",
    url: "https://arizonadailyindependent.com/2025/12/21/arizona-startup-real-estate-directory-challenges-zillows-pay-to-play-model/",
    tier: "trade",
    logo: arizonaDailyIndependentLogo,
  },
  {
    name: "StreetInsider",
    shortName: "StreetInsider",
    url: "https://www.streetinsider.com/Pinion+Newswire/414+Arizona+Agents+Receive+an+Invitation+They+Didn%E2%80%99t+Apply+For.+The+Other+220%2C000+Cannot+Buy+Their+Way+In./25754981.html",
    tier: "financial",
    logo: streetInsiderLogo,
  },
  {
    name: "AIJourn",
    shortName: "AIJourn",
    url: "https://aijourn.com/414-arizona-agents-receive-an-invitation-they-didnt-apply-for-the-other-220000-cannot-buy-their-way-in/",
    tier: "trade",
    logo: aiJournLogo,
  },
];

interface FeaturedInBarProps {
  variant?: "full" | "minimal";
}

export const FeaturedInBar = ({ variant = "full" }: FeaturedInBarProps) => {
  const { trackEvent } = useGA4Tracking();

  const handleArticleClick = (article: PressArticle) => {
    trackEvent("press_mention_click", {
      source: article.name,
    });
  };

  if (variant === "minimal") {
    return (
      <div className="flex flex-wrap justify-center items-center gap-4 md:gap-8 mt-6">
        {pressArticles.slice(0, 5).map((article) => (
          <a
            key={article.url}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleArticleClick(article)}
            className="flex items-center justify-center h-8 grayscale opacity-70 hover:opacity-100 hover:grayscale-0 transition-all duration-300"
            title={article.name}
          >
            {article.logo ? (
              <img 
                src={article.logo} 
                alt={article.name} 
                className="h-5 md:h-6 w-auto max-w-[100px] object-contain contrast-125 brightness-90"
              />
            ) : (
              <span className="text-xs font-semibold text-foreground/70">
                {article.shortName}
              </span>
            )}
          </a>
        ))}
      </div>
    );
  }

  return (
    <section className="container mx-auto px-4 py-8 border-y border-border/50 bg-muted/20">
      <div className="max-w-5xl mx-auto">
        <p className="text-sm text-muted-foreground text-center mb-4 uppercase tracking-wider font-medium">
          As Featured In
        </p>
        <div className="flex flex-wrap justify-center items-center gap-6 md:gap-10">
          {pressArticles.map((article) => (
            <a
              key={article.url}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleArticleClick(article)}
              className="flex items-center justify-center h-10 px-4 grayscale hover:grayscale-0 opacity-80 hover:opacity-100 transition-all duration-300 hover:scale-105"
              title={article.name}
            >
              {article.logo ? (
                <img 
                  src={article.logo} 
                  alt={article.name} 
                  className="h-6 md:h-8 w-auto max-w-[140px] object-contain contrast-125 brightness-90"
                />
              ) : (
                <span className="text-sm font-semibold text-foreground/80">
                  {article.shortName}
                </span>
              )}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};
