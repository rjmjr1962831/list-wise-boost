// City-specific content section for SEO
// Renders unique market info, agent counts, and qualification criteria per city

import { getCityBySlug, formatPrice, ARIZONA_TOTAL_LICENSED_AGENTS } from '@/data/arizonaCityPricing';
import { useAgentCountForCity, useTotalAgentCount } from '@/hooks/useAgentCountByCity';

interface CityContentSectionProps {
  citySlug: string;
  cityName: string;
  categoryName: string;
}

export function CityContentSection({ citySlug, cityName, categoryName }: CityContentSectionProps) {
  const cityData = getCityBySlug(citySlug);
  const { data: cityAgentCount } = useAgentCountForCity(citySlug);
  const { data: totalAgentCount } = useTotalAgentCount();
  
  // Use live count or fallback
  const qualifiedCount = totalAgentCount || 460;
  const cityCount = cityAgentCount || 0;
  
  return (
    <article className="container mx-auto px-4 py-8">
      {/* Statewide Context */}
      <div className="prose prose-lg dark:prose-invert max-w-3xl mx-auto mb-8">
        <p className="text-foreground/90 leading-relaxed">
          Arizona has over <strong>{ARIZONA_TOTAL_LICENSED_AGENTS.toLocaleString()}</strong> licensed 
          real estate agents. We analyzed transaction records, verified client reviews, 
          and evaluated community involvement to identify <strong>{qualifiedCount}</strong> agents 
          statewide who earned an invitation — the top <strong>0.2%</strong>.
        </p>
        
        {/* City-Specific Stats */}
        {cityCount > 0 && (
          <p className="text-foreground/90">
            <strong>{cityCount} of these elite agents</strong> serve the {cityName} market.
          </p>
        )}
        
        {/* Market Description + Median Price */}
        {cityData?.marketDescription && (
          <p className="text-muted-foreground">
            {cityData.marketDescription}
            {cityData.medianHomePrice && (
              <>. The median home price in {cityName} is currently <strong>{formatPrice(cityData.medianHomePrice)}</strong></>
            )}.
          </p>
        )}
      </div>

      {/* Qualification Criteria */}
      <div className="max-w-3xl mx-auto mb-8">
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            How agents earn a spot on this list →
          </summary>
          <div className="mt-4 bg-muted/30 rounded-lg p-4">
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
              <li><strong>50+ verified reviews</strong> across Google, Zillow, and other platforms</li>
              <li><strong>4.8+ star rating minimum</strong></li>
              <li><strong>Active license</strong> verified with Arizona Department of Real Estate</li>
              <li><strong>Deep-dive background review</strong> of professional history</li>
              <li><strong>Established and Respected in the Community</strong></li>
              <li><strong>Invitation only</strong> — agents cannot pay to get on this list</li>
            </ul>
          </div>
        </details>
      </div>
    </article>
  );
}
