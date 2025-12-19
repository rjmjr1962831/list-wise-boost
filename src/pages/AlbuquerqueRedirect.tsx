import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Navigate, useParams } from "react-router-dom";

export default function AlbuquerqueRedirect() {
  const { categorySlug, agentSlug } = useParams<{
    categorySlug: string;
    agentSlug?: string;
  }>();

  useEffect(() => {
    // GA4 page view (redirect helper route)
    if (typeof window.gtag === "function") {
      window.gtag("event", "page_view", {
        page_title: document.title,
        page_location: window.location.href,
        page_path: window.location.pathname,
      });
    }
  }, []);

  const target = `/new-mexico/albuquerque/${categorySlug || "top10realestateagents"}${
    agentSlug ? `/${agentSlug}` : ""
  }`;

  return (
    <>
      <Helmet>
        <title>Redirecting to Albuquerque, NM | Top10Lists.us</title>
        <meta
          name="description"
          content="Redirecting to the correct Albuquerque, New Mexico page."
        />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href={`https://www.top10lists.us${target}`} />
      </Helmet>
      <Navigate to={target} replace />
    </>
  );
}
