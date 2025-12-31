import { useEffect, useState } from "react";

const formulaItems = [
  { label: "Review Rating", weight: 25, color: "bg-primary" },
  { label: "Community Engagement", weight: 25, color: "bg-primary" },
  { label: "Number of Reviews", weight: 20, color: "bg-primary/80" },
  { label: "Transaction History", weight: 20, color: "bg-primary/80" },
  { label: "Credentials", weight: 10, color: "bg-primary/60" },
];

export const FormulaBarChart = () => {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 text-center">The Formula</h2>
        <div className="space-y-4">
          {formulaItems.map((item) => (
            <div key={item.label} className="flex items-center gap-4">
              <div className="w-40 md:w-48 text-sm font-medium text-foreground shrink-0">
                {item.label}
              </div>
              <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden">
                <div
                  className={`h-full ${item.color} rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-3`}
                  style={{
                    width: animated ? `${item.weight * 4}%` : "0%",
                  }}
                >
                  <span className="text-xs font-bold text-primary-foreground">
                    {item.weight}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
