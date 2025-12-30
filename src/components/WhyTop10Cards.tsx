import { Ban, Users, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const cards = [
  {
    icon: Ban,
    title: "No Pay-to-Play",
    description: "Agents can't buy their way onto this list. Period."
  },
  {
    icon: Users,
    title: "Community Counts",
    description: "We weight community involvement higher than sales volume."
  },
  {
    icon: ShieldCheck,
    title: "Verified Data",
    description: "Reviews, licenses, and records—all third-party confirmed."
  }
];

export const WhyTop10Cards = () => (
  <section className="container mx-auto px-4 py-12">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
      {cards.map((card) => (
        <Card key={card.title} className="text-center border-border/50">
          <CardContent className="p-6">
            <card.icon className="h-10 w-10 mx-auto mb-4 text-primary" />
            <h3 className="font-semibold text-lg mb-2">{card.title}</h3>
            <p className="text-sm text-muted-foreground">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  </section>
);
