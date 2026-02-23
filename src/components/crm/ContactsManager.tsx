import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Search, ExternalLink, Star } from "lucide-react";
import { toast } from "sonner";

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
  active: boolean;
}

export const ContactsManager = () => {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [stateFilter, setStateFilter] = useState("all");

  const searchProfessionals = useCallback(async (term: string, state: string) => {
    setIsLoading(true);
    let query = supabase
      .from("professionals")
      .select("id, name, email, phone, company, business_city, state_slug, current_tier, review_stars_rating, num_total_reviews, canonical_slug, active", { count: "exact" })
      .eq("active", true)
      .order("name", { ascending: true })
      .limit(50);

    if (state !== "all") {
      query = query.eq("state_slug", state);
    }

    if (term.length >= 2) {
      query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,company.ilike.%${term}%,business_city.ilike.%${term}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      toast.error("Failed to search professionals");
      console.error(error);
    } else {
      setProfessionals(data || []);
      setTotalCount(count || 0);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    searchProfessionals(searchTerm, stateFilter);
  }, [stateFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchProfessionals(searchTerm, stateFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const tierColor = (tier: string | null) => {
    switch (tier) {
      case "underwritten": return "default";
      case "audited": return "default";
      case "certified": return "secondary";
      default: return "outline";
    }
  };

  const states = [
    { value: "all", label: "All States" },
    { value: "arizona", label: "Arizona" },
    { value: "california", label: "California" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Professionals ({totalCount.toLocaleString()})</CardTitle>
            <div className="flex gap-2">
              {states.map(s => (
                <Button
                  key={s.value}
                  size="sm"
                  variant={stateFilter === s.value ? "default" : "outline"}
                  onClick={() => setStateFilter(s.value)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, company, or city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {searchTerm.length < 2 ? "Type 2+ characters to search. " : ""}
            Showing {professionals.length} of {totalCount.toLocaleString()} results.
          </p>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid gap-3">
          {professionals.map((pro) => (
            <Card key={pro.id}>
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
                        <a href={`mailto:${pro.email}`} className="flex items-center gap-1 text-sm text-primary hover:underline">
                          <Mail className="h-3 w-3" />{pro.email}
                        </a>
                      )}
                      {pro.email === "pending@123.com" && (
                        <span className="flex items-center gap-1 text-sm text-destructive">
                          <Mail className="h-3 w-3" />Bounced
                        </span>
                      )}
                      {pro.phone && (
                        <a href={`tel:${pro.phone}`} className="flex items-center gap-1 text-sm text-primary hover:underline">
                          <Phone className="h-3 w-3" />{pro.phone}
                        </a>
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
                  <div className="flex gap-2 shrink-0">
                    {pro.canonical_slug && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={`/artifact/${pro.id}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 mr-1" />Artifact
                        </a>
                      </Button>
                    )}
                    {pro.email && pro.email !== "pending@123.com" && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={`mailto:${pro.email}`}>Reply</a>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && professionals.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No professionals found
          </CardContent>
        </Card>
      )}
    </div>
  );
};
