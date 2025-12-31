import { AlertTriangle, Check } from "lucide-react";

const requirements = [
  "20+ verified reviews",
  "4.8+ star rating",
  "6+ years experience",
  "Active license, clean record",
];

export const QualificationGates = () => {
  return (
    <section className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="border-2 border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
            <h2 className="text-lg font-bold text-foreground">Minimum Requirements</h2>
          </div>
          <ul className="space-y-2 mb-4">
            {requirements.map((req) => (
              <li key={req} className="flex items-center gap-2 text-foreground">
                <Check className="h-4 w-4 text-green-600 shrink-0" />
                <span>{req}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm font-semibold text-foreground">
            Fail any = immediate removal.
          </p>
        </div>
      </div>
    </section>
  );
};
