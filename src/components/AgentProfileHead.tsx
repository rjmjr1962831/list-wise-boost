// src/components/AgentProfileHead.tsx
// SEO Head component for individual agent profile pages

import { Helmet } from 'react-helmet-async';
import { generateAgentProfileSchema, AgentData } from '@/utils/agentSchema';

interface AgentProfileHeadProps {
  agent: AgentData;
}

export function AgentProfileHead({ agent }: AgentProfileHeadProps) {
  const schema = generateAgentProfileSchema(agent);
  const currentYear = new Date().getFullYear();
  
  const title = `${agent.name} - Top Real Estate Agent in ${agent.city}, ${agent.stateAbbrev} | Top10Lists.us`;
  const description = `${agent.name} is a top-rated real estate agent in ${agent.city}, ${agent.stateAbbrev} with ${agent.yearsExperience} years experience and ${agent.totalSales.toLocaleString()} sales. ${agent.ratingValue}★ rating from ${agent.reviewCount} reviews.`;
  const url = `https://top10lists.us/profile/${agent.slug}`;
  
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      
      {/* Open Graph */}
      <meta property="og:title" content={`${agent.name} - Top Real Estate Agent in ${agent.city}`} />
      <meta property="og:description" content={agent.description} />
      <meta property="og:image" content={agent.image} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="profile" />
      <meta property="og:site_name" content="Top10Lists.us" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={agent.image} />
      
      {/* Freshness signals */}
      <meta property="article:modified_time" content={agent.dateModified} />
      <meta property="og:updated_time" content={agent.dateModified} />
      
      {/* Canonical URL */}
      <link rel="canonical" href={url} />
      
      {/* JSON-LD Schema */}
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
}

export default AgentProfileHead;
