import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Flame, MessageSquare, CreditCard, Info, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const phases = [
  {
    icon: Search,
    title: 'Month 1: Indexing',
    description: 'AI systems discover and index your expanded profile information across new city contexts.',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    icon: Flame,
    title: 'Month 2: Verification',
    description: 'Systems verify and cross-reference your credentials, reviews, and professional information.',
    color: 'text-accent',
    bgColor: 'bg-accent/10',
  },
  {
    icon: MessageSquare,
    title: 'Month 3: Citation Eligibility',
    description: 'Your profile becomes eligible for citation when AI tools respond to buyer queries.',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
];

export function WhyThreeMonths() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Why 3 Months?</h3>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CreditCard className="h-4 w-4" />
          <span>Billed monthly • Cancel anytime after</span>
        </div>
      </div>
      
      <p className="text-sm text-muted-foreground">
        AI systems require time to discover, verify, and incorporate profile information. 
        The 3-month minimum allows for complete integration—and early adopter discounts compensate for this warm-up period.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {phases.map((phase, index) => (
          <Card key={phase.title} className="relative overflow-hidden border-border">
            <CardContent className="p-4 space-y-3">
              {/* Phase number */}
              <div className="absolute top-2 right-2 text-4xl font-bold text-muted/20">
                {index + 1}
              </div>
              
              {/* Icon */}
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', phase.bgColor)}>
                <phase.icon className={cn('h-5 w-5', phase.color)} />
              </div>
              
              {/* Content */}
              <h4 className="font-semibold text-foreground">{phase.title}</h4>
              <p className="text-sm text-muted-foreground">{phase.description}</p>
            </CardContent>
            
            {/* Connector line */}
            {index < phases.length - 1 && (
              <div className="hidden md:block absolute top-1/2 -right-2 w-4 h-0.5 bg-border" />
            )}
          </Card>
        ))}
      </div>

      {/* Early Adopter Discount Explanation */}
      <Card className="bg-accent/5 border-accent/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Badge className="bg-accent text-accent-foreground shrink-0 mt-0.5">Early Adopter</Badge>
            <div className="space-y-1">
              <p className="font-medium text-foreground">Discounted rates during AI warm-up period</p>
              <p className="text-sm text-muted-foreground">
                Early adopters receive 50% off standard pricing. This discount compensates for the indexing timeline 
                and locks in your rate while your subscription remains active.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <CreditCard className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">Pay monthly, commit for 3 months</p>
              <p className="text-sm text-muted-foreground">
                You're charged each month—not upfront. After your 3-month commitment, 
                you can cancel anytime or continue month-to-month at your locked-in rate.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="p-3 rounded-lg bg-muted/20 border border-border/50">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            <strong>Eligibility does not guarantee AI recommendations.</strong> AI systems determine which sources to cite based on their own criteria. Payment affects distribution scope, not editorial ranking or inclusion decisions.
          </p>
        </div>
      </div>
    </div>
  );
}