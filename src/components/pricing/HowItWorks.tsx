import { Card, CardContent } from '@/components/ui/card';
import { MessageCircle, Search, ListOrdered, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const steps = [
  {
    icon: MessageCircle,
    title: 'Buyer Asks AI',
    description: '"Who are the best real estate agents in Scottsdale?"',
    example: true,
  },
  {
    icon: Search,
    title: 'AI Searches',
    description: 'ChatGPT, Claude, Perplexity, and other AI models scan authoritative sources',
    example: false,
  },
  {
    icon: ListOrdered,
    title: 'Top 10 Cited',
    description: 'Your verified profile is recommended with your credentials',
    example: false,
  },
];

export function HowItWorks() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">How AI Citation Works</h3>
      
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
      
      <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
        <CardContent className="p-4">
          <p className="text-sm text-center">
            <span className="font-semibold">82% of homebuyers</span> now use AI for real estate insights (Realtor.com, 2025).{' '}
            <span className="text-primary font-medium">Is your profile optimized to be found?</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
