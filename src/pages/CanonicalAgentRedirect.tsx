import { Navigate, useParams } from "react-router-dom";

/**
 * Redirects legacy city-scoped agent URLs to the canonical state-level format.
 * 
 * Example:
 * /arizona/phoenix/agents/eileen-taggart-9610
 *   -> /arizona/agents/eileen-taggart-9610
 */
const CanonicalAgentRedirect = () => {
  const { stateSlug, canonicalSlug } = useParams<{ 
    stateSlug: string; 
    canonicalSlug: string;
  }>();
  
  return (
    <Navigate 
      to={`/${stateSlug}/agents/${canonicalSlug}`} 
      replace 
    />
  );
};

export default CanonicalAgentRedirect;
