import { X } from "lucide-react";

const excludedItems = [
  "Advertising spend",
  "Referral fees",
  "Application fees",
  "Any payment",
];

export const WhatWeDontConsider = () => {
  return (
    <section className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-muted/60 rounded-lg p-6">
          <h2 className="text-lg font-bold mb-4 text-foreground">What We Don't Consider</h2>
          <ul className="space-y-2">
            {excludedItems.map((item) => (
              <li key={item} className="flex items-center gap-2 text-muted-foreground">
                <X className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};
