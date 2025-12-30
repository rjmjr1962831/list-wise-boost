import { ExternalLink } from "lucide-react";
import { useGA4Tracking } from "@/hooks/useGA4Tracking";

// Import logos
import businessInsiderLogo from "@/assets/logos/business-insider.svg";
import streetInsiderLogo from "@/assets/logos/streetinsider.png";
import aiJournLogo from "@/assets/logos/aijourn.png";
import arizonaDailyIndependentLogo from "@/assets/logos/arizona-daily-independent.png";
import financeWireLogo from "@/assets/logos/financewire.png";

interface PressArticle {
  name: string;
  shortName: string;
  url: string;
  tier: "tier1" | "financial" | "trade";
  logo?: string;
}

const pressArticles: PressArticle[] = [
  {
    name: "Markets Insider",
    shortName: "Markets Insider",
    url: "https://markets.businessinsider.com/news/currencies/robert-maynard-co-founder-of-lifelock-announces-top10lists-us-an-ai-optimized-platform-designed-for-the-next-era-of-consumer-search-1035676163",
    tier: "financial",
    logo: businessInsiderLogo, // Uses BI logo as Markets Insider is part of Business Insider
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
        <div className="flex flex-wrap justify-center items-center gap-6 md:gap-10">
          {pressArticles.map((article) => (
            <a
              key={article.url}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleArticleClick(article)}
              className="flex items-center justify-center h-10 px-4 grayscale hover:grayscale-0 opacity-70 hover:opacity-100 transition-all duration-300 hover:scale-105"
              title={article.name}
            >
              {article.logo ? (
                <img 
                  src={article.logo} 
                  alt={article.name} 
                  className="h-6 md:h-8 w-auto max-w-[140px] object-contain"
                />
              ) : (
                <span className="text-sm font-medium text-muted-foreground">
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
