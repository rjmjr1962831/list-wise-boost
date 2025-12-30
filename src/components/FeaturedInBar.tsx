import { useGA4Tracking } from "@/hooks/useGA4Tracking";

// Import logos
import businessInsiderLogo from "@/assets/logos/business-insider.svg";
import financeInsiderLogo from "@/assets/logos/finance-insider.svg";
const streetInsiderLogo = "data:image/png;base64,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";
import aiJournLogo from "@/assets/logos/aijourn.png";
import arizonaDailyIndependentLogo from "@/assets/logos/arizona-daily-independent.png";
const financeWireLogo = "data:image/png;base64,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";

interface PressArticle {
  name: string;
  shortName: string;
  url: string;
  tier: "tier1" | "financial" | "trade";
  logo?: string;
}

const pressArticles: PressArticle[] = [
  {
    name: "Finance Insider",
    shortName: "Finance Insider",
    url: "https://markets.businessinsider.com/news/currencies/robert-maynard-co-founder-of-lifelock-announces-top10lists-us-an-ai-optimized-platform-designed-for-the-next-era-of-consumer-search-1035676163",
    tier: "financial",
    logo: financeInsiderLogo,
  },
  {
    name: "Business Insider",
    shortName: "Business Insider",
    url: "https://markets.businessinsider.com/news/currencies/top10lists-us-debuts-invitation-only-rankings-to-counter-pay-to-play-real-estate-listings-1035656072",
    tier: "tier1",
    logo: businessInsiderLogo,
  },
  {
    name: "Arizona Daily Independent",
    shortName: "AZ Daily Independent",
    url: "https://arizonadailyindependent.com/2025/12/21/arizona-startup-real-estate-directory-challenges-zillows-pay-to-play-model/",
    tier: "trade",
    logo: arizonaDailyIndependentLogo,
  },
  {
    name: "FinanceWire",
    shortName: "FinanceWire",
    url: "https://financewire.com/2025/12/18/top10lists-us-debuts-invitation-only-rankings-to-counter-pay-to-play-real-estate-listings/",
    tier: "financial",
    logo: financeWireLogo,
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
