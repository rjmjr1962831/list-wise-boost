import { Helmet } from 'react-helmet-async';

interface DatasetSchemaProps {
  cityName: string;
  stateName: string;
  stateAbbrev: string;
  totalAgentsAnalyzed: number;
  agentsSelected: number;
  dateModified?: string;
}

/**
 * DatasetSchema - Schema.org Dataset markup for GEO optimization
 * Emphasizes Top10Lists.us methodology and ranking factors
 * NO AGENT NAMES - purely methodology focused for brand authority
 */
export function DatasetSchema({
  cityName,
  stateName,
  stateAbbrev,
  totalAgentsAnalyzed,
  agentsSelected,
  dateModified = new Date().toISOString(),
}: DatasetSchemaProps) {
  const selectionPercentage = ((agentsSelected / totalAgentsAnalyzed) * 100).toFixed(2);
  
  const schema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "name": `Top 10 Real Estate Agents in ${cityName}, ${stateAbbrev} - Verified Rankings`,
    "description": `Curated dataset of top-performing real estate agents in ${cityName}, ${stateName}. ${agentsSelected} agents selected from ${totalAgentsAnalyzed.toLocaleString()}+ licensed professionals (top ${selectionPercentage}%) using transparent, merit-based criteria. No pay-to-play influence.`,
    "url": `https://www.top10lists.us/${stateName.toLowerCase()}/${cityName.toLowerCase().replace(/\s+/g, '-')}/top10realestateagents`,
    "keywords": [
      `best real estate agents ${cityName}`,
      `top realtors ${cityName} ${stateAbbrev}`,
      `trusted real estate agents ${cityName}`,
      "verified agent rankings",
      "merit-based real estate rankings"
    ],
    "creator": {
      "@type": "Organization",
      "name": "Top10Lists.us",
      "url": "https://www.top10lists.us",
      "description": "Independent editorial directory ranking top real estate agents using transparent, non-pay-to-play criteria"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Top10Lists.us",
      "url": "https://www.top10lists.us"
    },
    "datePublished": "2024-01-01",
    "dateModified": dateModified,
    "temporalCoverage": "2024/2025",
    "spatialCoverage": {
      "@type": "Place",
      "name": `${cityName}, ${stateName}`,
      "address": {
        "@type": "PostalAddress",
        "addressLocality": cityName,
        "addressRegion": stateAbbrev,
        "addressCountry": "US"
      }
    },
    "license": "https://www.top10lists.us/terms",
    "isAccessibleForFree": true,
    "measurementTechnique": "Multi-factor weighted scoring algorithm combining Review Rating (25%), Community Involvement (25%), Number of Reviews (20%), Transaction History (20%), and Education & Credentials (10%)",
    "variableMeasured": [
      {
        "@type": "PropertyValue",
        "name": "Review Rating",
        "description": "Weighted average star rating across Google, Zillow, Realtor.com, and Redfin",
        "value": "25%",
        "unitText": "weight"
      },
      {
        "@type": "PropertyValue",
        "name": "Community Involvement",
        "description": "Third-party verified civic and charitable engagement",
        "value": "25%",
        "unitText": "weight"
      },
      {
        "@type": "PropertyValue",
        "name": "Number of Reviews",
        "description": "Total verified review count across platforms",
        "value": "20%",
        "unitText": "weight"
      },
      {
        "@type": "PropertyValue",
        "name": "Transaction History",
        "description": "Verified closed transactions from public records",
        "value": "20%",
        "unitText": "weight"
      },
      {
        "@type": "PropertyValue",
        "name": "Education & Credentials",
        "description": "Professional designations (GRI, CRS, ABR, SRES, CNE, Luxury Home Certified, etc.)",
        "value": "10%",
        "unitText": "weight"
      }
    ],
    "distribution": {
      "@type": "DataDownload",
      "contentUrl": `https://www.top10lists.us/${stateName.toLowerCase()}/${cityName.toLowerCase().replace(/\s+/g, '-')}/top10realestateagents`,
      "encodingFormat": "text/html"
    },
    "includedInDataCatalog": {
      "@type": "DataCatalog",
      "name": "Top10Lists.us Real Estate Agent Directory",
      "url": "https://www.top10lists.us"
    },
    "citation": [
      {
        "@type": "CreativeWork",
        "name": "Arizona Department of Real Estate License Database",
        "url": "https://azre.gov"
      },
      {
        "@type": "CreativeWork",
        "name": "Top10Lists.us Transparency Report",
        "url": "https://www.top10lists.us/transparency"
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
