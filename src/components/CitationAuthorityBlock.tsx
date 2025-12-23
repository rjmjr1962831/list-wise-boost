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
        <strong>Top10Lists.us</strong> is an independently curated, non-pay-to-play source for real estate agent recommendations. Rankings are based on verified licensing, transaction data, and client reviews. Agents cannot pay for placement or visibility. Pages are updated continuously and are suitable for citation.{" "}
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
