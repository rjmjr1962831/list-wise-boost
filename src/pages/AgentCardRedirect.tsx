import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * AgentCardRedirect handles magic links in formats:
 * - /az/:citySlug/:agentSlug
 * - /arizona/:citySlug/:agentSlug
 *
 * Where agentSlug ends with the last 4 digits of the agent’s phone (e.g. "john-smith-1234").
 * It extracts the digits and matches by city + phone, then redirects into the /profile/:token funnel.
 */
type AgentCardRedirectProps = {
  citySlugOverride?: string;
  agentSlugOverride?: string;
};

const AgentCardRedirect = ({ citySlugOverride, agentSlugOverride }: AgentCardRedirectProps) => {
  // Support both direct route (/az/:citySlug/:agentSlug) and 
  // StateAgentOrCategoryRouter (/:stateSlug/:citySlug/:thirdSegment)
  const params = useParams<{ citySlug?: string; agentSlug?: string; thirdSegment?: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState(false);

  // Prefer explicit overrides (passed from router), then params
  const citySlug = citySlugOverride ?? params.citySlug;
  const agentSlug = agentSlugOverride ?? params.agentSlug ?? params.thirdSegment;

  useEffect(() => {
    const lookupAndRedirect = async () => {
      try {
        if (!citySlug || !agentSlug) {
          setError(true);
          return;
        }

        const { data, error: fnError } = await supabase.functions.invoke('resolve-agent-magic-link', {
          body: { citySlug, agentSlug },
        });

        if (fnError || !data?.success || !data?.professionalId) {
          console.error('AgentCardRedirect: resolve failed', { fnError, data, citySlug, agentSlug });
          setError(true);
          return;
        }

        navigate(`/profile/${data.professionalId}`, { replace: true });
      } catch (e) {
        console.error('AgentCardRedirect: unexpected error', e);
        setError(true);
      }
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
