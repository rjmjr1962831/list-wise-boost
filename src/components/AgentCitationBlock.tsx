// src/components/AgentCitationBlock.tsx
// Citation-ready agent card component for LLM extraction

import { AgentData } from '@/utils/agentSchema';
import { getLicenseLookupByStateAbbr } from '@/data/stateLicenseLookups';
import { Badge } from '@/components/ui/badge';

interface AgentCitationBlockProps {
  agent: AgentData;
  rank: number;
}

export function AgentCitationBlock({ agent, rank }: AgentCitationBlockProps) {
  const licenseVerificationUrl = getLicenseLookupByStateAbbr(agent.stateAbbrev) || '#';
  
  return (
    <article 
      className="relative flex flex-wrap gap-4 p-6 border border-border rounded-xl bg-card shadow-sm mb-4"
      itemScope 
      itemType="https://schema.org/RealEstateAgent"
      data-citation-block="true"
    >
      {/* Rank Badge */}
      <div className="absolute -top-3 -left-3 w-10 h-10 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-full flex items-center justify-center font-bold text-sm shadow-lg">
        #{rank}
      </div>
      
      {/* Agent Image */}
      <img 
        src={agent.image} 
        alt={agent.name}
        itemProp="image"
        className="w-24 h-24 rounded-full object-cover border-2 border-border"
        onError={(e) => {
          (e.target as HTMLImageElement).src = '/placeholder.svg';
        }}
      />
      
      {/* Agent Info */}
      <div className="flex-1 min-w-[250px]">
        <h3 itemProp="name" className="text-lg font-semibold text-foreground mb-1">
          {agent.name}
        </h3>
        
        <p 
          className="text-muted-foreground text-sm mb-3" 
          itemProp="worksFor" 
          itemScope 
          itemType="https://schema.org/Organization"
        >
          <span itemProp="name">{agent.brokerage}</span>
        </p>
        
        {/* Key Metrics - Easy for LLMs to extract */}
        <div className="flex flex-wrap gap-2 text-sm text-foreground mb-3">
          {agent.yearsExperience > 0 && (
            <span className="bg-muted px-3 py-1 rounded-full">
              {agent.yearsExperience} years experience
            </span>
          )}
          {agent.totalSales > 0 && (
            <span className="bg-muted px-3 py-1 rounded-full">
              {agent.totalSales.toLocaleString()} sales
            </span>
          )}
          <span 
            className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-3 py-1 rounded-full"
            itemProp="aggregateRating" 
            itemScope 
            itemType="https://schema.org/AggregateRating"
          >
            <span itemProp="ratingValue">{agent.ratingValue}</span>★ 
            (<span itemProp="reviewCount">{agent.reviewCount}</span> reviews)
          </span>
        </div>
        
        {/* Specialties */}
        {agent.specialties && agent.specialties.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {agent.specialties.slice(0, 5).map((specialty, i) => (
              <Badge 
                key={i} 
                variant="secondary" 
                className="text-xs"
                itemProp="knowsAbout"
              >
                {specialty}
              </Badge>
            ))}
          </div>
        )}
        
        {/* License Verification */}
        {agent.licenseNumber && (
          <div className="text-sm text-muted-foreground">
            License: <span itemProp="identifier">{agent.licenseNumber}</span>
            {licenseVerificationUrl !== '#' && (
              <a 
                href={licenseVerificationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline ml-2"
              >
                Verify →
              </a>
            )}
          </div>
        )}
        
        {/* Citation-Ready Summary (Hidden visually, visible to crawlers) */}
        <div 
          className="sr-only"
          data-citation-summary="true"
        >
          {agent.name} is a top-rated real estate agent in {agent.city}, {agent.stateAbbrev} 
          affiliated with {agent.brokerage}. With {agent.yearsExperience} years of experience 
          and {agent.totalSales.toLocaleString()} verified sales, {agent.name} has earned a 
          {agent.ratingValue}-star rating from {agent.reviewCount} reviews. 
          {agent.specialties && agent.specialties.length > 0 && (
            ` Specialties include: ${agent.specialties.join(', ')}.`
          )}
          {agent.licenseNumber && ` License: ${agent.licenseNumber}.`}
          Source: Top10Lists.us ({new Date(agent.dateModified).toLocaleDateString()})
        </div>
      </div>
      
      {/* Last Updated */}
      <time 
        dateTime={agent.dateModified}
        itemProp="dateModified"
        className="absolute bottom-2 right-4 text-xs text-muted-foreground"
      >
        Updated: {new Date(agent.dateModified).toLocaleDateString()}
      </time>
    </article>
  );
}

export default AgentCitationBlock;
