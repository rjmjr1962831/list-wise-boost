import { Navigate, useParams } from "react-router-dom";

/**
 * Redirects legacy /az/:citySlug/:neighborhoodSlug/:categorySlug format to the
 * canonical 4-segment neighborhood+category format under /arizona.
 *
 * Example:
 * /az/phoenix/arcadia/top10realestateagents
 *   -> /arizona/phoenix/arcadia/top10realestateagents
 */
const AzNeighborhoodRedirect = () => {
  const { citySlug, neighborhoodSlug, categorySlug } = useParams<{
    citySlug: string;
    neighborhoodSlug: string;
    categorySlug: string;
  }>();

  return (
    <Navigate
      to={`/arizona/${citySlug}/${neighborhoodSlug}/${categorySlug}`}
      replace
    />
  );
};

export default AzNeighborhoodRedirect;
