import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, User, Building, MapPin, Star, Award } from "lucide-react";

interface EnrichedAgent {
  id: string;
  name: string;
  company: string;
  city: string;
  state: string;
}

const recentlyEnrichedAgents: EnrichedAgent[] = [
  {
    id: "219ca70c-782f-4339-8048-c0dee62f0bd3",
    name: "Ben Graham",
    company: "eXp Realty",
    city: "Chandler",
    state: "AZ"
  },
  {
    id: "fab8f849-2149-410a-9cc8-65388615150a",
    name: "Dave Zajdzinski",
    company: "EXP Realty",
    city: "Chandler",
    state: "AZ"
  },
  {
    id: "9597c234-5844-4871-abbb-bb31c40814d1",
    name: "Terry Parrish",
    company: "West USA Realty",
    city: "Chandler",
    state: "AZ"
  },
  {
    id: "c6942d83-a64b-4d30-8937-3d1f4dbe1b51",
    name: "Armando Padilla",
    company: "RE/Max of Santa Clarita",
    city: "Santa Clarita",
    state: "CA"
  },
  {
    id: "4304b84e-6851-4f08-8ce1-708d62a2f04a",
    name: "Lennie Primrose",
    company: "My Home Group",
    city: "Chandler",
    state: "AZ"
  }
];

export const RecentEnrichmentLinks = () => {
  const generateAgentUrl = (agent: EnrichedAgent) => {
    const stateSlug = agent.state === "AZ" ? "arizona" : "california";
    const citySlug = agent.city.toLowerCase().replace(/\s+/g, '-');
    return `/${stateSlug}/${citySlug}/top10realestateagents?highlight=${agent.id}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          Recently Enriched Agents (Exa + Hybrid Synthesis)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {recentlyEnrichedAgents.map((agent) => (
            <a
              key={agent.id}
              href={generateAgentUrl(agent)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {agent.name}
                  </p>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Building className="h-3 w-3" />
                      {agent.company}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {agent.city}, {agent.state}
                    </span>
                  </div>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </a>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          These agents were enriched using the new 5-query Exa search with hybrid DeepSeek/Sonnet synthesis.
        </p>
      </CardContent>
    </Card>
  );
};
