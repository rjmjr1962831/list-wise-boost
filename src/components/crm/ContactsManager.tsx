import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Search, Star } from "lucide-react";
import { toast } from "sonner";
import { ContactDetail } from "./ContactDetail";

interface Professional {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  business_city: string | null;
  state_slug: string | null;
  current_tier: string | null;
  review_stars_rating: number | null;
  num_total_reviews: number | null;
  canonical_slug: string | null;
}

export const ContactsManager = () => {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedPro, setSelectedPro] = useState<Professional | null>(null);

  const searchProfessionals = useCallback(async (term: string) => {
    if (term.length < 2) {
      setProfessionals([]);
      setHasSearched(false);
      return;
    }
    setIsLoading(true);
    setHasSearched(true);

    const { data, error } = await supabase
      .from("professionals")
      .select("id, name, email, phone, company, business_city, state_slug, current_tier, review_stars_rating, num_total_reviews, canonical_slug")
      .eq("active", true)
      .or(`name.ilike.%${term}%,email.ilike.%${term}%,company.ilike.%${term}%,business_city.ilike.%${term}%`)
      .order("name", { ascending: true })
      .limit(25);

    if (error) {
      toast.error("Search failed");
      console.error(error);
    } else {
      setProfessionals(data || []);
    }
    setIsLoading(false);
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    const timer = setTimeout(() => searchProfessionals(value), 300);
    return () => clearTimeout(timer);
  };

  const tierColor = (tier: string | null) => {
    switch (tier) {
      case "underwritten": return "default";
      case "audited": return "default";
      case "certified": return "secondary";
      default: return "outline";
    }
  };

  if (selectedPro) {
    return <ContactDetail professional={selectedPro} onBack={() => setSelectedPro(null)} />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Search Contacts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, company, or city..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {!isLoading && professionals.length > 0 && (
        <div className="grid gap-3">
          {professionals.map((pro) => (
            <Card key={pro.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelectedPro(pro)}>
              <CardContent className="py-4 px-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{pro.name}</h3>
                      <Badge variant={tierColor(pro.current_tier)}>
                        {pro.current_tier || "listed"}
                      </Badge>
                    </div>
                    {pro.company && (
                      <p className="text-sm text-muted-foreground truncate">{pro.company}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      {pro.email && pro.email !== "pending@123.com" && (
                        <span className="flex items-center gap-1 text-sm text-primary">
                          <Mail className="h-3 w-3" />{pro.email}
                        </span>
                      )}
                      {pro.email === "pending@123.com" && (
                        <span className="flex items-center gap-1 text-sm text-destructive">
                          <Mail className="h-3 w-3" />Bounced
                        </span>
                      )}
                      {pro.phone && (
                        <span className="flex items-center gap-1 text-sm text-primary">
                          <Phone className="h-3 w-3" />{pro.phone}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      {pro.business_city && <span>{pro.business_city}, {pro.state_slug?.toUpperCase()}</span>}
                      {pro.review_stars_rating && (
                        <span className="flex items-center gap-0.5">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          {pro.review_stars_rating} ({pro.num_total_reviews} reviews)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && hasSearched && professionals.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No professionals found
          </CardContent>
        </Card>
      )}
    </div>
  );
};
