import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Award, Star, TrendingUp, MapPin, Users, Home } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, ReactNode } from "react";
import { PageMetadata, Professional } from "@/types/professional";
import { useGA4Tracking } from "@/hooks/useGA4Tracking";
import { LastUpdatedBanner } from "@/components/LastUpdatedBanner";

interface ProfessionalListLayoutProps {
  metadata: PageMetadata;
  professionals: Professional[];
  children: ReactNode;
  heroIcons?: Array<{ icon: ReactNode; label: string }>;
  lastUpdated?: string;
}

export const ProfessionalListLayout = ({
  metadata,
  professionals,
  children,
  heroIcons,
  lastUpdated
}: ProfessionalListLayoutProps) => {
  const { trackEvent } = useGA4Tracking();
  
  useEffect(() => {
    // Scroll depth tracking (75%)
    const handleScroll = () => {
      const scrollDepth = (window.scrollY + window.innerHeight) / document.body.scrollHeight;
      if (scrollDepth > 0.75 && !window._scrollTracked) {
        window._scrollTracked = true;
        trackEvent('scroll_depth', {
          percent_scrolled: 75,
          page_path: window.location.pathname
        });
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window._scrollTracked = false;
    };
  }, [trackEvent]);

  useEffect(() => {
    // Add JSON-LD structured data for SEO with freshness signals
    // Note: Title, description, canonical, and OG tags are handled by React Helmet in DynamicCategoryList
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": metadata.title,
      "description": metadata.description,
      "itemListOrder": "https://schema.org/ItemListOrderDescending",
      "numberOfItems": professionals.length,
      ...(lastUpdated && { "dateModified": lastUpdated }),
      "itemListElement": professionals.map(professional => ({
        "@type": "ListItem",
        "position": professional.rank,
        "item": {
          "@type": metadata.profession.schemaType,
          "name": professional.name,
          "description": professional.description,
          "knowsAbout": professional.specialties,
          ...(professional.license_number && { "license": professional.license_number }),
          "address": {
            "@type": "PostalAddress",
            "streetAddress": professional.address.split(",")[0],
            "addressLocality": metadata.location.city,
            "addressRegion": metadata.location.stateAbbr,
            "addressCountry": "US",
            "postalCode": professional.address.match(/\d{5}/)?.[0]
          },
          "telephone": professional.phone,
          "url": `https://${professional.website}`,
          "image": professional.image,
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": professional.rating,
            "reviewCount": professional.reviews,
            "bestRating": 5
          },
          "geo": {
            "@type": "GeoCoordinates",
            "latitude": "33.3528",
            "longitude": "-111.7890"
          },
          "areaServed": {
            "@type": "City",
            "name": metadata.location.city,
            "containedIn": {
              "@type": "State",
              "name": metadata.location.state
            }
          }
        }
      }))
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(structuredData);
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [metadata, professionals, lastUpdated]);

  // Calculate actual average rating from professionals
  const calculateAverageRating = () => {
    const professionalsWithRatings = professionals.filter(p => p.rating > 0);
    if (professionalsWithRatings.length === 0) return null;
    const sum = professionalsWithRatings.reduce((acc, p) => acc + p.rating, 0);
    const avg = sum / professionalsWithRatings.length;
    return avg.toFixed(1);
  };

  const averageRating = calculateAverageRating();
  const ratingLabel = averageRating ? `${averageRating} Average Rating` : "Top Rated";

  const defaultHeroIcons = [
    { icon: <Award className="h-5 w-5 text-primary" />, label: "All Verified" },
    { icon: <Star className="h-5 w-5 text-primary" />, label: ratingLabel },
    { icon: <TrendingUp className="h-5 w-5 text-primary" />, label: "Proven Records" },
    { icon: <MapPin className="h-5 w-5 text-primary" />, label: `${metadata.location.city} Specialists` }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-20 right-10 w-64 h-64 bg-turquoise/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-96 left-0 w-80 h-80 bg-sunset-orange/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-96 right-20 w-72 h-72 bg-terracotta/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-cactus-green/10 rounded-full blur-3xl pointer-events-none" />
      
      {/* Breadcrumb */}
      <nav className="bg-muted/50 border-b" aria-label="Breadcrumb">
        <div className="container mx-auto px-4 py-3">
          <ol className="flex items-center gap-2 text-sm text-muted-foreground" itemScope itemType="https://schema.org/BreadcrumbList">
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <Link to="/" className="hover:text-foreground transition-colors" itemProp="item">
                <span itemProp="name">Home</span>
              </Link>
              <meta itemProp="position" content="1" />
            </li>
            {metadata.breadcrumbs.map((crumb, index) => (
              <>
                <span key={`sep-${index}`}>/</span>
                <li key={`crumb-${index}`} itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
                  {crumb.path ? (
                    <Link to={crumb.path} className="hover:text-foreground transition-colors" itemProp="item">
                      <span itemProp="name">{crumb.name}</span>
                    </Link>
                  ) : (
                    <span className="text-foreground font-medium" itemProp="name">{crumb.name}</span>
                  )}
                  <meta itemProp="position" content={(index + 2).toString()} />
                </li>
              </>
            ))}
          </ol>
        </div>
      </nav>

      {/* Hero Section - Supporting content only (H1 is in parent page) */}
      <section className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-6xl mx-auto space-y-6">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="px-3 py-1">Verified List</Badge>
              <Badge variant="outline" className="px-3 py-1">Updated Monthly</Badge>
              <Badge variant="outline" className="px-3 py-1">2025</Badge>
            </div>
            <p className="text-lg text-muted-foreground">
              {metadata.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-4 pt-2">
            {(heroIcons || defaultHeroIcons).map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                {item.icon}
                <span className="text-sm font-medium">{item.label}</span>
              </div>
            ))}
          </div>
          
          {/* Freshness indicator for LLM optimization */}
          {lastUpdated && (
            <LastUpdatedBanner lastUpdated={lastUpdated} className="pt-4" />
          )}
        </div>
      </section>

      {/* Main Content */}
      <section className="container mx-auto px-4 pb-20">
        <div className="max-w-6xl mx-auto space-y-8">
          {children}
        </div>
      </section>

      {/* Info Section */}
      <section className="bg-muted/50 py-12 border-t relative">
        <div className="absolute top-0 left-0 w-20 h-20 bg-gradient-to-br from-turquoise/20 to-transparent rounded-br-full" />
        <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-tl from-terracotta/20 to-transparent rounded-tl-full" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto space-y-6">
            <h2 className="text-2xl md:text-3xl font-bold text-center">About This List</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 bg-gradient-to-br from-turquoise/20 to-turquoise/10 rounded-full flex items-center justify-center ring-2 ring-turquoise/20">
                  <Users className="h-6 w-6 text-turquoise" />
                </div>
                <h3 className="font-semibold">Verified Professionals</h3>
                <p className="text-sm text-muted-foreground">
                  All professionals verified for active licensing, performance records, and professional standing
                </p>
              </div>
              <div className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 bg-gradient-to-br from-sunset-orange/20 to-sunset-orange/10 rounded-full flex items-center justify-center ring-2 ring-sunset-orange/20">
                  <TrendingUp className="h-6 w-6 text-sunset-orange" />
                </div>
                <h3 className="font-semibold">Performance Metrics</h3>
                <p className="text-sm text-muted-foreground">
                  Ranked by key performance indicators and client reviews
                </p>
              </div>
              <div className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 bg-gradient-to-br from-cactus-green/20 to-cactus-green/10 rounded-full flex items-center justify-center ring-2 ring-cactus-green/20">
                  <Home className="h-6 w-6 text-cactus-green" />
                </div>
                <h3 className="font-semibold">Local Expertise</h3>
                <p className="text-sm text-muted-foreground">
                  Deep knowledge of {metadata.location.city} and surrounding areas
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-card py-16 border-t">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-2xl md:text-3xl font-bold">
              Are You a Top {metadata.profession.singular}?
            </h2>
            <p className="text-lg text-muted-foreground">
              Apply to be featured on our verified list of top professionals in {metadata.location.city}. 
              Boost your talent and connect with more clients.
            </p>
            <Button asChild size="lg">
              <Link to="/">Apply for Listing</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30 py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; 2025 Top10Lists.us. All rights reserved.</p>
          <Link to="/" className="hover:text-foreground transition-colors inline-block mt-2">
            Return to Homepage
          </Link>
        </div>
      </footer>
    </div>
  );
};
