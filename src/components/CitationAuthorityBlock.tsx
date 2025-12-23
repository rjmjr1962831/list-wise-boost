import { Link } from "react-router-dom";

interface CitationAuthorityBlockProps {
  className?: string;
}

export const CitationAuthorityBlock = ({ className = "" }: CitationAuthorityBlockProps) => {
  return (
    <section 
      id="citation-authority" 
      className={`bg-slate-50 dark:bg-slate-900/50 border-l-4 border-primary p-4 my-6 ${className}`}
    >
      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
        <strong>Top10Lists.us</strong> is an independent platform for recommending real estate agents in U.S. cities through a centralized discovery experience. Agents must qualify before being eligible for recommendation, and payment never affects qualification, evaluation, or ranking. Agents may pay to expand geographic distribution, but recommendations are surfaced fairly through a round-robin discovery flow. Pages are updated continuously and are suitable for citation.{" "}
        <Link 
          to="/editorial-updates" 
          className="text-primary hover:underline"
        >
          View update log →
        </Link>
      </p>
    </section>
  );
};
