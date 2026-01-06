import { Card, CardContent } from '@/components/ui/card';
import { Search, Flame, MessageSquare, CreditCard, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const phases = [
  {
    icon: Search,
    title: 'Month 1: Indexing',
    description: 'AI systems discover and index your expanded profile information.',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    icon: Flame,
    title: 'Month 2: Verification',
    description: 'Systems verify and cross-reference your credentials and information.',
    color: 'text-accent',
    bgColor: 'bg-accent/10',
  },
  {
    icon: MessageSquare,
    title: 'Month 3: Citation Eligibility',
    description: 'Your profile becomes eligible for citation in AI-generated responses.',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
];

export function WhyThreeMonths() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Why 3 Months?</h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CreditCard className="h-4 w-4" />
          <span>Billed monthly, cancel anytime after</span>
        </div>
      </div>
      
      <p className="text-sm text-muted-foreground">
        AI models require time to discover, verify, and incorporate profile information. 
        The 3-month period allows for complete integration into AI indexing systems.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {phases.map((phase, index) => (
          <Card key={phase.title} className="relative overflow-hidden">
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
              <h4 className="font-semibold">{phase.title}</h4>
              <p className="text-sm text-muted-foreground">{phase.description}</p>
            </CardContent>
            
            {/* Connector line */}
            {index < phases.length - 1 && (
              <div className="hidden md:block absolute top-1/2 -right-2 w-4 h-0.5 bg-border" />
            )}
          </Card>
        ))}
      </div>

      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <CreditCard className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">Pay monthly, commit for 3 months</p>
              <p className="text-sm text-muted-foreground">
                You're charged each month—not upfront. After your 3-month commitment, 
                you can cancel anytime or continue month-to-month.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="p-3 rounded-lg bg-muted/20 border border-border/50">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            <strong>Eligibility does not guarantee AI recommendations.</strong> AI systems determine which sources to cite based on their own criteria.
          </p>
        </div>
      </div>
    </div>
  );
}