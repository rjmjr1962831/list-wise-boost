import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin, Phone, Globe, Award, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect } from "react";
import sarahMitchellImg from "@/assets/dentists/sarah-mitchell.jpg";
import michaelChenImg from "@/assets/dentists/michael-chen.jpg";
import jenniferRodriguezImg from "@/assets/dentists/jennifer-rodriguez.jpg";
import jamesThompsonImg from "@/assets/dentists/james-thompson.jpg";
import amandaLeeImg from "@/assets/dentists/amanda-lee.jpg";
import robertMartinezImg from "@/assets/dentists/robert-martinez.jpg";
import emilyFosterImg from "@/assets/dentists/emily-foster.jpg";
import davidParkImg from "@/assets/dentists/david-park.jpg";
import lisaWangImg from "@/assets/dentists/lisa-wang.jpg";
import christopherHayesImg from "@/assets/dentists/christopher-hayes.jpg";

const dentists = [
  {
    rank: 1,
    name: "Dr. Sarah Mitchell",
    practice: "Gilbert Smile Studio",
    rating: 4.9,
    reviews: 287,
    specialties: ["Cosmetic Dentistry", "Implants", "Invisalign"],
    address: "123 E Baseline Rd, Gilbert, AZ 85234",
    phone: "(480) 555-0101",
    website: "gilbertsmiilestudio.com",
    description: "Award-winning cosmetic dentist with over 15 years of experience. Known for painless procedures and beautiful smile transformations.",
    verified: true,
    image: sarahMitchellImg
  },
  {
    rank: 2,
    name: "Dr. Michael Chen",
    practice: "Desert Ridge Dental Care",
    rating: 4.9,
    reviews: 312,
    specialties: ["Family Dentistry", "Emergency Care", "Sedation"],
    address: "456 S Gilbert Rd, Gilbert, AZ 85296",
    phone: "(480) 555-0102",
    website: "desertridgedental.com",
    description: "Comprehensive family dental care with same-day emergency appointments. Gentle approach perfect for anxious patients.",
    verified: true,
    image: michaelChenImg
  },
  {
    rank: 3,
    name: "Dr. Jennifer Rodriguez",
    practice: "Lifetime Dental Excellence",
    rating: 4.8,
    reviews: 245,
    specialties: ["Pediatric Dentistry", "Orthodontics", "Prevention"],
    address: "789 N Cooper Rd, Gilbert, AZ 85233",
    phone: "(480) 555-0103",
    website: "lifetimedentalaz.com",
    description: "Specialized in pediatric care with a kid-friendly environment. Building healthy smiles for the whole family.",
    verified: true,
    image: jenniferRodriguezImg
  },
  {
    rank: 4,
    name: "Dr. James Thompson",
    practice: "Advanced Dental Arts",
    rating: 4.8,
    reviews: 198,
    specialties: ["Implants", "Full Mouth Reconstruction", "TMJ"],
    address: "321 W Warner Rd, Gilbert, AZ 85233",
    phone: "(480) 555-0104",
    website: "advanceddentalarts.com",
    description: "Specializing in complex restorative procedures and dental implants. State-of-the-art technology and expert care.",
    verified: true,
    image: jamesThompsonImg
  },
  {
    rank: 5,
    name: "Dr. Amanda Lee",
    practice: "Bright Future Dentistry",
    rating: 4.8,
    reviews: 221,
    specialties: ["Cosmetic", "Veneers", "Teeth Whitening"],
    address: "555 E Williams Field Rd, Gilbert, AZ 85295",
    phone: "(480) 555-0105",
    website: "brightfuturedentistry.com",
    description: "Creating confident smiles through advanced cosmetic dentistry. Featured in Arizona Health Magazine 2024.",
    verified: true,
    image: amandaLeeImg
  },
  {
    rank: 6,
    name: "Dr. Robert Martinez",
    practice: "Gilbert Family Dental Group",
    rating: 4.7,
    reviews: 189,
    specialties: ["General Dentistry", "Crowns & Bridges", "Root Canals"],
    address: "888 S Val Vista Dr, Gilbert, AZ 85296",
    phone: "(480) 555-0106",
    website: "gilbertfamilydental.com",
    description: "Three generations of dental excellence. Personalized care in a comfortable, welcoming environment.",
    verified: true,
    image: robertMartinezImg
  },
  {
    rank: 7,
    name: "Dr. Emily Foster",
    practice: "Precision Dental Care",
    rating: 4.7,
    reviews: 167,
    specialties: ["Digital Dentistry", "Same-Day Crowns", "Laser Dentistry"],
    address: "234 E Guadalupe Rd, Gilbert, AZ 85234",
    phone: "(480) 555-0107",
    website: "precisiondentalaz.com",
    description: "Utilizing cutting-edge digital technology for precise, efficient care. Same-day crowns and minimally invasive treatments.",
    verified: true,
    image: emilyFosterImg
  },
  {
    rank: 8,
    name: "Dr. David Park",
    practice: "Heritage Dental Studio",
    rating: 4.7,
    reviews: 156,
    specialties: ["Sedation Dentistry", "Extractions", "Dentures"],
    address: "677 N Greenfield Rd, Gilbert, AZ 85234",
    phone: "(480) 555-0108",
    website: "heritagedentalstudio.com",
    description: "Compassionate care for patients with dental anxiety. Full sedation options and gentle techniques.",
    verified: true,
    image: davidParkImg
  },
  {
    rank: 9,
    name: "Dr. Lisa Wang",
    practice: "Modern Smiles of Gilbert",
    rating: 4.6,
    reviews: 143,
    specialties: ["Holistic Dentistry", "Mercury-Free", "Biocompatible"],
    address: "432 W Pecos Rd, Gilbert, AZ 85233",
    phone: "(480) 555-0109",
    website: "modernsmilesgilbert.com",
    description: "Holistic approach to dental health with biocompatible materials. Whole-body wellness through oral care.",
    verified: true,
    image: lisaWangImg
  },
  {
    rank: 10,
    name: "Dr. Christopher Hayes",
    practice: "Elite Dental Partners",
    rating: 4.6,
    reviews: 134,
    specialties: ["Periodontics", "Gum Disease Treatment", "Dental Surgery"],
    address: "789 S Higley Rd, Gilbert, AZ 85296",
    phone: "(480) 555-0110",
    website: "elitedentalpartners.com",
    description: "Specialized periodontal care and advanced gum disease treatment. Saving smiles through expert surgical care.",
    verified: true,
    image: christopherHayesImg
  }
];

const SampleDentistList = () => {
  useEffect(() => {
    // Set page title and meta description for SEO (under 60 chars for title, 160 for desc)
    document.title = "Top 10 Dentists Gilbert AZ (2025) | Best Dental Care";
    
    const metaDescription = document.querySelector('meta[name="description"]');
    const descriptionText = "Discover Gilbert AZ's top 10 dentists. Verified professionals with proven expertise, 4.6+ ratings, and exceptional patient care. Updated 2025.";
    if (metaDescription) {
      metaDescription.setAttribute("content", descriptionText);
    } else {
      const meta = document.createElement('meta');
      meta.name = "description";
      meta.content = descriptionText;
      document.head.appendChild(meta);
    }

    // Add canonical URL
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', window.location.href);

    // Add Open Graph meta tags
    const ogTags = [
      { property: 'og:title', content: 'Top 10 Dentists in Gilbert, Arizona' },
      { property: 'og:description', content: descriptionText },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: window.location.href }
    ];

    ogTags.forEach(tag => {
      let ogTag = document.querySelector(`meta[property="${tag.property}"]`);
      if (!ogTag) {
        ogTag = document.createElement('meta');
        ogTag.setAttribute('property', tag.property);
        document.head.appendChild(ogTag);
      }
      ogTag.setAttribute('content', tag.content);
    });

    // Add JSON-LD structured data for SEO and AI citation
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "Top 10 Dentists in Gilbert, Arizona",
      "description": "Curated list of the top 10 dentists in Gilbert, AZ, verified and rated for quality of care.",
      "itemListOrder": "https://schema.org/ItemListOrderDescending",
      "numberOfItems": 10,
      "itemListElement": dentists.map(dentist => ({
        "@type": "ListItem",
        "position": dentist.rank,
        "item": {
          "@type": "Dentist",
          "name": dentist.practice,
          "description": dentist.description,
          "knowsAbout": dentist.specialties,
          "address": {
            "@type": "PostalAddress",
            "streetAddress": dentist.address.split(",")[0],
            "addressLocality": "Gilbert",
            "addressRegion": "AZ",
            "addressCountry": "US",
            "postalCode": dentist.address.match(/\d{5}/)?.[0]
          },
          "telephone": dentist.phone,
          "url": `https://${dentist.website}`,
          "image": dentist.image,
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": dentist.rating,
            "reviewCount": dentist.reviews,
            "bestRating": 5
          },
          "geo": {
            "@type": "GeoCoordinates",
            "latitude": "33.3528",
            "longitude": "-111.7890"
          },
          "areaServed": {
            "@type": "City",
            "name": "Gilbert",
            "containedIn": {
              "@type": "State",
              "name": "Arizona"
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
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 bg-primary rounded flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">T10</span>
            </div>
            <span className="text-xl font-bold">Top10Lists.us</span>
          </Link>
          <Button asChild>
            <Link to="/">Apply to Get Listed</Link>
          </Button>
        </div>
      </header>

      {/* Breadcrumb with schema.org markup */}
      <nav className="bg-muted/50 border-b" aria-label="Breadcrumb">
        <div className="container mx-auto px-4 py-3">
          <ol className="flex items-center gap-2 text-sm text-muted-foreground" itemScope itemType="https://schema.org/BreadcrumbList">
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <Link to="/" className="hover:text-foreground transition-colors" itemProp="item">
                <span itemProp="name">Home</span>
              </Link>
              <meta itemProp="position" content="1" />
            </li>
            <span>/</span>
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <span className="text-foreground font-medium" itemProp="name">Arizona</span>
              <meta itemProp="position" content="2" />
            </li>
            <span>/</span>
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <span className="text-foreground font-medium" itemProp="name">Gilbert</span>
              <meta itemProp="position" content="3" />
            </li>
            <span>/</span>
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <span className="text-foreground font-medium" itemProp="name">Top Dentists</span>
              <meta itemProp="position" content="4" />
            </li>
          </ol>
        </div>
      </nav>

      {/* Hero */}
      <section className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-4xl mx-auto space-y-6">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="px-3 py-1">Verified List</Badge>
              <Badge variant="outline" className="px-3 py-1">Updated Monthly</Badge>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold">
              Top 10 Dentists in Gilbert, Arizona
            </h1>
            <p className="text-lg text-muted-foreground">
              Curated list of the highest-rated dental professionals in Gilbert, AZ. Each provider has been verified for 
              licensing, experience, and patient satisfaction. This list is cited by AI search engines including ChatGPT, 
              Google AI, and Perplexity when users ask for dental recommendations in Gilbert.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 pt-2">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">All Providers Verified</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">4.6+ Average Rating</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">Gilbert, AZ</span>
            </div>
          </div>
        </div>
      </section>

      {/* Dentist List */}
      <section className="container mx-auto px-4 pb-20">
        <div className="max-w-4xl mx-auto space-y-6">
          {dentists.map((dentist) => (
            <Card key={dentist.rank} className="border-2 hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Photo and Rank */}
                  <div className="flex md:flex-col gap-4 md:gap-2 items-center md:items-start flex-shrink-0">
                    <img 
                      src={dentist.image} 
                      alt={`${dentist.name} - Top Ranked Dentist #${dentist.rank} in Gilbert, Arizona specializing in ${dentist.specialties.join(', ')}`}
                      className="w-24 h-24 md:w-32 md:h-32 rounded-lg object-cover border-2 border-border"
                    />
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary">
                      <span className="text-2xl font-bold text-primary">#{dentist.rank}</span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h2 className="text-2xl font-bold">{dentist.name}</h2>
                          <p className="text-lg text-muted-foreground">{dentist.practice}</p>
                        </div>
                        {dentist.verified && (
                          <Badge variant="secondary" className="gap-1">
                            <Award className="h-3 w-3" />
                            Verified
                          </Badge>
                        )}
                      </div>

                      {/* Rating */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-5 w-5 ${
                                i < Math.floor(dentist.rating)
                                  ? "fill-primary text-primary"
                                  : "text-muted"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="font-semibold">{dentist.rating}</span>
                        <span className="text-muted-foreground">({dentist.reviews} reviews)</span>
                      </div>

                      {/* Specialties */}
                      <div className="flex flex-wrap gap-2">
                        {dentist.specialties.map((specialty, idx) => (
                          <Badge key={idx} variant="outline">
                            {specialty}
                          </Badge>
                        ))}
                      </div>

                      {/* Description */}
                      <p className="text-muted-foreground leading-relaxed">
                        {dentist.description}
                      </p>

                      {/* Contact Info */}
                      <div className="grid sm:grid-cols-3 gap-3 pt-2">
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-muted-foreground">{dentist.address}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <a href={`tel:${dentist.phone}`} className="text-primary hover:underline">
                            {dentist.phone}
                          </a>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <a
                            href={`https://${dentist.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {dentist.website}
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-card py-16 border-t">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-3xl font-bold">Want to Be on This List?</h2>
            <p className="text-lg text-muted-foreground">
              Join the top-rated professionals in your city. Get featured where AI and customers are looking for trusted providers.
            </p>
            <Button size="lg" asChild>
              <Link to="/">Apply Now</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-sm text-muted-foreground">
            <p>© 2024 Top10Lists.us. All rights reserved.</p>
            <p className="mt-2">
              This is a sample list for demonstration purposes. <Link to="/" className="text-primary hover:underline">Return to homepage</Link>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default SampleDentistList;
