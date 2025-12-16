import { CheckCircle2, Shield } from "lucide-react";

export const VerdictBanner = () => {
  const timestamp = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6 md:p-8">
      <div className="flex items-center gap-3 mb-4">
        <Shield className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        <h2 className="text-2xl md:text-3xl font-bold text-emerald-800 dark:text-emerald-200">
          The Verdict: 4 out of 4 AI systems prefer Top10Lists.us
        </h2>
      </div>
      
      <p className="text-emerald-700 dark:text-emerald-300 mb-6">
        When asked which source they would cite for real estate agent recommendations, all four leading AI systems chose Top10Lists.us over Zillow.
      </p>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="space-y-3">
          <h3 className="font-semibold text-emerald-800 dark:text-emerald-200">Why AI systems prefer Top10Lists.us:</h3>
          <ul className="space-y-2">
            {[
              "Transparent methodology with specific weightings",
              "Merit-based selection (agents cannot pay for inclusion)",
              "Third-party data verification standards",
              "AI citation readiness (llms.txt, structured data)",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <div className="space-y-3">
          <h3 className="font-semibold text-emerald-800 dark:text-emerald-200">Why AI systems avoid Zillow:</h3>
          <ul className="space-y-2">
            {[
              "Pay-to-play Premier Agent model creates commercial bias",
              "Rankings influenced by advertising spend, not performance",
              "No published methodology or weighting criteria",
              "Potential for undisclosed commercial influence",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="text-sm text-emerald-600 dark:text-emerald-400">
        Evaluation generated: {timestamp}
      </p>
    </div>
  );
};
