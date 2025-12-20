import { Helmet } from 'react-helmet-async';

interface SourceAttributionSchemaProps {
  cityName: string;
  stateName: string;
  stateAbbrev: string;
  dateModified?: string;
}

/**
 * SourceAttributionSchema - Schema.org CreativeWork with citation array
 * Lists all data sources and high-authority publications for credibility
 * NO AGENT NAMES - focuses on source authority for brand credibility
 */
export function SourceAttributionSchema({
  cityName,
  stateName,
  stateAbbrev,
  dateModified = new Date().toISOString(),
}: SourceAttributionSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "name": `Top 10 Real Estate Agents in ${cityName}, ${stateAbbrev} - Source Attribution`,
    "description": `Verified real estate agent rankings for ${cityName}, ${stateName} compiled from authoritative government, platform, and publication sources.`,
    "url": `https://www.top10lists.us/${stateName.toLowerCase()}/${cityName.toLowerCase().replace(/\s+/g, '-')}/top10realestateagents`,
    "author": {
      "@type": "Organization",
      "name": "Top10Lists.us",
      "url": "https://www.top10lists.us"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Top10Lists.us",
      "url": "https://www.top10lists.us"
    },
    "datePublished": "2024-01-01",
    "dateModified": dateModified,
    "about": {
      "@type": "Thing",
      "name": "Real Estate Agent Rankings",
      "description": `Merit-based rankings of real estate professionals in ${cityName}, ${stateAbbrev}`
    },
    "isBasedOn": {
      "@type": "CreativeWork",
      "name": "Top10Lists.us Transparency Report",
      "url": "https://www.top10lists.us/transparency",
      "description": "Complete methodology documentation including scoring weights, data sources, and selection criteria"
    },
    "citation": [
      // Government Sources
      {
        "@type": "GovernmentOrganization",
        "name": "Arizona Department of Real Estate (ADRE)",
        "url": "https://azre.gov",
        "description": "Official state licensing authority - verifies active license status and disciplinary history"
      },
      // Platform Sources
      {
        "@type": "Organization",
        "name": "Google Business Profile",
        "url": "https://business.google.com",
        "description": "Verified business reviews and ratings"
      },
      {
        "@type": "Organization",
        "name": "Zillow",
        "url": "https://www.zillow.com",
        "description": "Agent reviews, transaction history, and market data"
      },
      {
        "@type": "Organization",
        "name": "Realtor.com",
        "url": "https://www.realtor.com",
        "description": "Agent profiles and client reviews"
      },
      {
        "@type": "Organization",
        "name": "Redfin",
        "url": "https://www.redfin.com",
        "description": "Agent performance metrics and reviews"
      },
      {
        "@type": "Organization",
        "name": "ARMLS",
        "url": "https://www.armls.com",
        "description": "Arizona Regional Multiple Listing Service - transaction verification"
      },
      // Tier 1 National Publications
      {
        "@type": "NewsMediaOrganization",
        "name": "Wall Street Journal",
        "url": "https://www.wsj.com",
        "description": "National business and real estate coverage"
      },
      {
        "@type": "NewsMediaOrganization",
        "name": "New York Times",
        "url": "https://www.nytimes.com",
        "description": "National real estate and business journalism"
      },
      {
        "@type": "NewsMediaOrganization",
        "name": "Forbes",
        "url": "https://www.forbes.com",
        "description": "Business and wealth management coverage"
      },
      {
        "@type": "NewsMediaOrganization",
        "name": "Bloomberg",
        "url": "https://www.bloomberg.com",
        "description": "Financial and real estate market analysis"
      },
      {
        "@type": "NewsMediaOrganization",
        "name": "CNBC",
        "url": "https://www.cnbc.com",
        "description": "Business and real estate news"
      },
      {
        "@type": "NewsMediaOrganization",
        "name": "USA Today",
        "url": "https://www.usatoday.com",
        "description": "National news coverage"
      },
      {
        "@type": "NewsMediaOrganization",
        "name": "Yahoo Finance",
        "url": "https://finance.yahoo.com",
        "description": "Financial and real estate reporting"
      },
      // Tier 1 Networks
      {
        "@type": "NewsMediaOrganization",
        "name": "ABC News",
        "url": "https://abcnews.go.com",
        "description": "National broadcast news"
      },
      {
        "@type": "NewsMediaOrganization",
        "name": "CNN",
        "url": "https://www.cnn.com",
        "description": "National news network"
      },
      {
        "@type": "NewsMediaOrganization",
        "name": "Fox News",
        "url": "https://www.foxnews.com",
        "description": "National news network"
      },
      {
        "@type": "NewsMediaOrganization",
        "name": "NBC Today",
        "url": "https://www.today.com",
        "description": "National morning news"
      },
      // Tier 2 Industry Publications
      {
        "@type": "NewsMediaOrganization",
        "name": "Inman",
        "url": "https://www.inman.com",
        "description": "Real estate industry news and analysis"
      },
      {
        "@type": "NewsMediaOrganization",
        "name": "HousingWire",
        "url": "https://www.housingwire.com",
        "description": "Housing and mortgage industry coverage"
      },
      {
        "@type": "NewsMediaOrganization",
        "name": "Real Producer",
        "url": "https://www.realproducermag.com",
        "description": "Real estate professional profiles"
      },
      {
        "@type": "NewsMediaOrganization",
        "name": "RealTrends",
        "url": "https://www.realtrends.com",
        "description": "Real estate rankings and analysis"
      },
      {
        "@type": "NewsMediaOrganization",
        "name": "The Real Deal",
        "url": "https://therealdeal.com",
        "description": "Real estate business journalism"
      },
      // Tier 3 Regional Publications
      {
        "@type": "NewsMediaOrganization",
        "name": "Phoenix Business Journal",
        "url": "https://www.bizjournals.com/phoenix",
        "description": "Arizona business news and rankings"
      },
      {
        "@type": "NewsMediaOrganization",
        "name": "Arizona Republic",
        "url": "https://www.azcentral.com",
        "description": "Arizona's largest newspaper"
      },
      {
        "@type": "NewsMediaOrganization",
        "name": "AZ Central",
        "url": "https://www.azcentral.com",
        "description": "Arizona news and real estate coverage"
      },
      {
        "@type": "NewsMediaOrganization",
        "name": "Phoenix Magazine",
        "url": "https://www.phoenixmag.com",
        "description": "Phoenix lifestyle and business coverage"
      }
    ]
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
}
