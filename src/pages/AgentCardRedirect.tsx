import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * AgentCardRedirect handles magic links in format: /az/city-slug/firstname-lastname-1234
 * Extracts last 4 digits from the agentSlug and matches by city + phone
 * 
 * NOTE: This only handles /az/:citySlug/:agentSlug routes. The /arizona/ routes are
 * handled by the more specific /:stateSlug/:citySlug/:categorySlug route which matches first.
 */
const AgentCardRedirect = () => {
  const { citySlug, agentSlug } = useParams<{ citySlug: string; agentSlug: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState(false);

  useEffect(() => {
    const lookupAndRedirect = async () => {
      if (!citySlug || !agentSlug) {
        setError(true);
        return;
      }

      // Extract last 4 digits from agentSlug (e.g., "john-smith-1234" -> "1234")
      const phoneDigits = agentSlug.slice(-4);
      if (!/^\d{4}$/.test(phoneDigits)) {
        console.error("Invalid phone digits in slug:", agentSlug);
        setError(true);
        return;
      }

      // Look up the city by slug
      const { data: city, error: cityError } = await supabase
        .from("cities")
        .select("id")
        .eq("slug", citySlug)
        .maybeSingle();

      if (cityError || !city) {
        console.error("City not found:", citySlug);
        setError(true);
        return;
      }

      // Look up the professional by city and last 4 digits of phone
      const { data: professionals, error: profError } = await supabase
        .from("professionals")
        .select("id, phone, name")
        .eq("city_id", city.id)
        .eq("active", true);

      if (profError || !professionals || professionals.length === 0) {
        console.error("No professionals found for city:", citySlug);
        setError(true);
        return;
      }

      // Find the professional whose phone ends with the given digits
      const matchingProfessional = professionals.find((p) => {
        if (!p.phone) return false;
        const digits = p.phone.replace(/\D/g, "");
        return digits.slice(-4) === phoneDigits;
      });

      if (!matchingProfessional) {
        console.error("No matching professional found for phone digits:", phoneDigits);
        setError(true);
        return;
      }

      // Redirect to the funnel intro page (magic link landing)
      navigate(`/profile/${matchingProfessional.id}`, { replace: true });
    };

    lookupAndRedirect();
  }, [citySlug, agentSlug, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Agent Not Found</h1>
          <p className="text-muted-foreground">This agent link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
};

export default AgentCardRedirect;
