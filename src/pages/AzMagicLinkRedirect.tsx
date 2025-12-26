import { Navigate, useParams } from "react-router-dom";

/**
 * Redirects old /az/:citySlug/:agentSlug format to the new 4-segment format
 * /arizona/:citySlug/top10realestateagents/:agentSlug
 */
const AzMagicLinkRedirect = () => {
  const { citySlug, agentSlug } = useParams<{ citySlug: string; agentSlug: string }>();
  
  return (
    <Navigate 
      to={`/arizona/${citySlug}/top10realestateagents/${agentSlug}`} 
      replace 
    />
  );
};

export default AzMagicLinkRedirect;
