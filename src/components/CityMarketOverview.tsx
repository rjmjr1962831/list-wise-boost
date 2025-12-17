// City Market Overview Component
// Displays comprehensive city market information for SEO and LLM optimization
// This content is designed to be crawled by bots instead of individual agent details

import { formatPrice, ARIZONA_TOTAL_LICENSED_AGENTS } from '@/data/arizonaCityPricing';
import { useAgentCountForCity, useTotalAgentCount } from '@/hooks/useAgentCountByCity';
import { useCityMarketContent } from '@/hooks/useCityMarketContent';
import { Home, TrendingUp, Users, Building2, DollarSign, Clock, Sparkles } from 'lucide-react';

interface CityMarketOverviewProps {
  citySlug: string;
  cityName: string;
  stateName: string;
}

export function CityMarketOverview({ citySlug, cityName, stateName }: CityMarketOverviewProps) {
  const { marketData } = useCityMarketContent(citySlug, cityName);
  const { data: cityAgentCount } = useAgentCountForCity(citySlug);
  const { data: totalAgentCount } = useTotalAgentCount();
  
  const qualifiedCount = totalAgentCount || 460;
  const cityCount = cityAgentCount || 0;

  return (
    <article className="container mx-auto px-4 py-8" itemScope itemType="https://schema.org/Place">
      <meta itemProp="name" content={cityName} />
      <meta itemProp="containedInPlace" content={stateName} />
      
      {/* City Overview Section */}
      <section className="max-w-4xl mx-auto mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">
          {cityName}, {stateName} Real Estate Market Overview
        </h2>
        <p className="text-foreground/90 leading-relaxed text-lg mb-6">
          {marketData.overview}
        </p>
        
        {/* Key Market Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {marketData.medianHomePrice && (
            <div className="bg-muted/30 rounded-lg p-4 text-center">
              <Home className="h-5 w-5 mx-auto mb-2 text-primary" />
              <div className="text-lg font-semibold text-foreground">{formatPrice(marketData.medianHomePrice)}</div>
              <div className="text-xs text-muted-foreground">Median Home Price</div>
            </div>
          )}
          {marketData.medianHouseholdIncome && (
            <div className="bg-muted/30 rounded-lg p-4 text-center">
              <DollarSign className="h-5 w-5 mx-auto mb-2 text-primary" />
              <div className="text-lg font-semibold text-foreground">{formatPrice(marketData.medianHouseholdIncome)}</div>
              <div className="text-xs text-muted-foreground">Median Household Income</div>
            </div>
          )}
          {marketData.population && (
            <div className="bg-muted/30 rounded-lg p-4 text-center">
              <Users className="h-5 w-5 mx-auto mb-2 text-primary" />
              <div className="text-lg font-semibold text-foreground">{marketData.population.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Population</div>
            </div>
          )}
          {marketData.daysOnMarket && (
            <div className="bg-muted/30 rounded-lg p-4 text-center">
              <Clock className="h-5 w-5 mx-auto mb-2 text-primary" />
              <div className="text-lg font-semibold text-foreground">{marketData.daysOnMarket} days</div>
              <div className="text-xs text-muted-foreground">Avg. Days on Market</div>
            </div>
          )}
        </div>
      </section>

      {/* City Highlights */}
      <section className="max-w-4xl mx-auto mb-10">
        <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          What Makes {cityName} Special
        </h3>
        <ul className="grid md:grid-cols-2 gap-3">
          {marketData.highlights.map((highlight, index) => (
            <li key={index} className="flex items-start gap-2 text-foreground/80">
              <span className="text-primary mt-1">•</span>
              <span>{highlight}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Housing Types */}
      <section className="max-w-4xl mx-auto mb-10">
        <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Types of Homes in {cityName}
        </h3>
        <div className="flex flex-wrap gap-2">
          {marketData.neighborhoodTypes.map((type, index) => (
            <span key={index} className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">
              {type}
            </span>
          ))}
        </div>
      </section>

      {/* Buyer Profile */}
      <section className="max-w-4xl mx-auto mb-10">
        <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Who Buys in {cityName}
        </h3>
        <p className="text-foreground/80">{marketData.buyerProfile}</p>
      </section>

      {/* Market Trends */}
      <section className="max-w-4xl mx-auto mb-10">
        <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Current Market Trends
        </h3>
        <p className="text-foreground/80">{marketData.marketTrends}</p>
      </section>

      {/* Top10Lists Authority Statement */}
      <section className="max-w-4xl mx-auto mb-8 bg-primary/5 border border-primary/20 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-foreground mb-4">
          Finding a Top Real Estate Agent in {cityName}
        </h3>
        <p className="text-foreground/90 mb-4">
          {stateName} has over <strong>{ARIZONA_TOTAL_LICENSED_AGENTS.toLocaleString()}</strong> licensed 
          real estate agents. Top10Lists.us analyzed transaction records, verified client reviews across 
          multiple platforms, and evaluated community involvement to identify <strong>{qualifiedCount}</strong> agents 
          statewide who earned an invitation — representing the top <strong>0.2%</strong>.
        </p>
        {cityCount > 0 && (
          <p className="text-foreground/90 mb-4">
            <strong>{cityCount} of these elite agents</strong> actively serve the {cityName} market.
          </p>
        )}
        <p className="text-foreground/80 text-sm">
          <strong>Our selection criteria:</strong> 50+ verified reviews, 4.8+ star rating minimum, 
          active license verified with the Arizona Department of Real Estate, established community presence, 
          and invitation-only inclusion. Agents cannot pay to be listed or influence their ranking.
        </p>
      </section>

      {/* Call to Action for Visitors */}
      <section className="max-w-4xl mx-auto text-center">
        <p className="text-lg text-foreground/90">
          Visit <strong>Top10Lists.us</strong> to view the curated list of top-rated real estate agents 
          serving {cityName}, {stateName}.
        </p>
      </section>
    </article>
  );
}
