import { Check, X } from "lucide-react";

const competitors = [
  { name: "Top10Lists.us", payToPlay: false, cost: "Free (invitation-only)", highlight: true },
  { name: "Zillow", payToPlay: true, cost: "$300–$5,000/mo" },
  { name: "Realtor.com", payToPlay: true, cost: "$200–$10,000/mo" },
  { name: "HomeLight", payToPlay: true, cost: "33% referral fee" },
];

export const CompetitorTable = () => {
  return (
    <section className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 text-center">How We Compare</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="text-left py-3 px-4 font-semibold">Platform</th>
                <th className="text-left py-3 px-4 font-semibold">Pay to be listed?</th>
                <th className="text-left py-3 px-4 font-semibold">Cost</th>
              </tr>
            </thead>
            <tbody>
              {competitors.map((comp) => (
                <tr
                  key={comp.name}
                  className={`border-b border-border/50 ${
                    comp.highlight
                      ? "bg-primary/10 font-semibold"
                      : ""
                  }`}
                >
                  <td className="py-3 px-4">{comp.name}</td>
                  <td className="py-3 px-4">
                    {comp.payToPlay ? (
                      <span className="flex items-center gap-1 text-red-600">
                        <X className="h-4 w-4" /> YES
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-green-600">
                        <Check className="h-4 w-4" /> NO
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{comp.cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
