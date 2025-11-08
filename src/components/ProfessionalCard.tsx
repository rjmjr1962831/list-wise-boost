import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin, Phone, Globe, Award } from "lucide-react";
import { Professional } from "@/types/professional";

interface ProfessionalCardProps {
  professional: Professional;
  accentColor?: "primary" | "sunset-orange" | "terracotta" | "turquoise" | "cactus-green";
  schemaType?: string;
}

export const ProfessionalCard = ({ 
  professional, 
  accentColor = "primary",
  schemaType = "Person"
}: ProfessionalCardProps) => {
  const borderColorClass = `border-l-${accentColor}`;
  const shadowColorClass = `hover:shadow-${accentColor}/10`;

  return (
    <Card 
      className={`border-2 border-l-4 ${borderColorClass} hover:shadow-lg ${shadowColorClass} transition-all`}
      itemScope 
      itemType={`https://schema.org/${schemaType}`}
    >
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Photo and Rank */}
          <div className="flex md:flex-col gap-4 md:gap-2 items-center md:items-start flex-shrink-0">
            <img 
              src={professional.image} 
              alt={`${professional.name}${professional.title ? `, ${professional.title}` : ''}`}
              className="w-24 h-24 md:w-32 md:h-32 rounded-lg object-cover border-2 border-border"
              itemProp="image"
            />
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary">
              <span className="text-2xl font-bold text-primary">#{professional.rank}</span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 space-y-4">
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold" itemProp="name">
                    {professional.name}
                    {professional.title && <span className="text-muted-foreground">, {professional.title}</span>}
                  </h2>
                  <p className="text-lg text-muted-foreground" itemProp="affiliation">
                    {professional.company}
                  </p>
                </div>
                {professional.verified && (
                  <Badge variant="secondary" className="gap-1">
                    <Award className="h-3 w-3" />
                    Verified
                  </Badge>
                )}
              </div>

              {/* Rating */}
              <div className="flex items-center gap-2" itemProp="aggregateRating" itemScope itemType="https://schema.org/AggregateRating">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${
                        i < Math.floor(professional.rating)
                          ? "fill-primary text-primary"
                          : "text-muted"
                      }`}
                    />
                  ))}
                </div>
                <span className="font-semibold" itemProp="ratingValue">{professional.rating}</span>
                <span className="text-muted-foreground">(<span itemProp="reviewCount">{professional.reviews}</span> reviews)</span>
                <meta itemProp="bestRating" content="5" />
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-3 border-y">
                {Object.entries(professional.stats).map(([key, value]) => {
                  const labels: Record<string, string> = {
                    salesLast12Mo: "Sales (12mo)",
                    saleToListRatio: "Sale to List",
                    avgDaysOnMarket: "Avg Days Market",
                    yearsExperience: "Years Exp.",
                    patientsServed: "Patients Served",
                    successRate: "Success Rate"
                  };
                  
                  return (
                    <div key={key} className="text-center md:text-left">
                      <div className="text-2xl font-bold text-primary">{value}</div>
                      <div className="text-xs text-muted-foreground">{labels[key] || key}</div>
                    </div>
                  );
                })}
              </div>

              {/* Specialties */}
              <div className="flex flex-wrap gap-2">
                {professional.specialties.map((specialty, idx) => (
                  <Badge key={idx} variant="outline">
                    {specialty}
                  </Badge>
                ))}
              </div>

              {/* Description */}
              <p className="text-muted-foreground leading-relaxed" itemProp="description">
                {professional.description}
              </p>

              {/* Contact Info */}
              <div className="grid sm:grid-cols-3 gap-3 pt-2">
                <div className="flex items-center gap-2 text-sm" itemProp="address" itemScope itemType="https://schema.org/PostalAddress">
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">
                    <span itemProp="streetAddress">{professional.address.split(",")[0]}</span>,{" "}
                    <span itemProp="addressLocality">{professional.address.split(",")[1]?.trim()}</span>,{" "}
                    <span itemProp="addressRegion">{professional.address.match(/[A-Z]{2}/)?.[0]}</span>{" "}
                    <span itemProp="postalCode">{professional.address.match(/\d{5}/)?.[0]}</span>
                    <meta itemProp="addressCountry" content="US" />
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <a href={`tel:${professional.phone}`} className="text-primary hover:underline" itemProp="telephone">
                    {professional.phone}
                  </a>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <a
                    href={`https://${professional.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                    itemProp="url"
                  >
                    {professional.website}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
