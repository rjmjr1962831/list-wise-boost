import { Card, CardContent } from '@/components/ui/card';
import { MessageCircle, Search, Eye, ArrowRight, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const steps = [
  {
    icon: MessageCircle,
    title: 'Buyer Searches',
    description: '"Who are top real estate agents in Scottsdale?"',
    example: true,
  },
  {
    icon: Search,
    title: 'AI Gathers Sources',
    description: 'AI models scan authoritative sources including Top10Lists.us for relevant professionals.',
    example: false,
  },
  {
    icon: Eye,
    title: 'Results Displayed',
    description: 'Your profile information may appear when users search for agents in your coverage areas.',
    example: false,
  },
];

export function HowItWorks() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">How AI Discovery Works</h3>
      
      <div className="flex flex-col md:flex-row gap-4 items-stretch">
        {steps.map((step, index) => (
          <div key={step.title} className="flex-1 flex items-center gap-2">
            <Card className={cn(
              'flex-1',
              step.example && 'border-primary/30 bg-primary/5'
            )}>
              <CardContent className="p-4 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <step.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold">{step.title}</h4>
                  <p className={cn(
                    'text-sm',
                    step.example ? 'text-primary italic' : 'text-muted-foreground'
                  )}>
                    {step.description}
                  </p>
                </div>
              </CardContent>
            </Card>
            
            {index < steps.length - 1 && (
              <ArrowRight className="hidden md:block h-5 w-5 text-muted-foreground shrink-0" />
            )}
          </div>
        ))}
      </div>

      <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            AI systems determine which sources to cite based on their own criteria. Visibility options expand your presence but do not control AI recommendation behavior.
          </p>
        </div>
      </div>
    </div>
  );
}
