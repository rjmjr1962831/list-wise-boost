// src/components/CityListingHead.tsx
// SEO Head component for city listing pages (Top 10 lists)

import { Helmet } from 'react-helmet-async';
import { generateCityListingSchema, CityListingData } from '@/utils/cityListingSchema';

interface CityListingHeadProps {
  listing: CityListingData;
}

export function CityListingHead({ listing }: CityListingHeadProps) {
  const schemas = generateCityListingSchema(listing);
  const currentYear = new Date().getFullYear();
  
  const topAgent = listing.agents[0];
  const url = `https://www.top10lists.us/${listing.stateSlug}/${listing.slug}`;
  
  const title = `Top 10 Real Estate Agents in ${listing.city}, ${listing.stateAbbrev} (${currentYear}) | Top10Lists.us`;
  const description = topAgent
    ? `Find the best real estate agents in ${listing.city}, ${listing.stateAbbrev}. #1: ${topAgent.name} (${topAgent.brokerage}) with ${topAgent.ratingValue}★ rating. Verified rankings updated weekly.`
    : `Find the best real estate agents in ${listing.city}, ${listing.stateAbbrev}. AI-curated rankings based on verified reviews and transaction data.`;
  
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      
      {/* Open Graph */}
      <meta property="og:title" content={`Top 10 Real Estate Agents in ${listing.city}, ${listing.stateAbbrev}`} />
      <meta property="og:description" content={`Curated list of top-rated agents in ${listing.city}. Rankings based on verified reviews and transaction data.`} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Top10Lists.us" />
      <meta property="og:image" content="https://www.top10lists.us/og-image.png" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content="https://www.top10lists.us/og-image.png" />
      
      {/* Freshness signals */}
      <meta property="article:modified_time" content={listing.dateModified} />
      <meta property="og:updated_time" content={listing.dateModified} />
      
      {/* Canonical URL */}
      <link rel="canonical" href={url} />
      
      {/* Output all schemas */}
      {schemas.map((schema, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
}

export default CityListingHead;
