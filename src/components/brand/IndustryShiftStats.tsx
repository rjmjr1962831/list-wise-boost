import { Card, CardContent } from '@/components/ui/card';
import { TrendingDown, TrendingUp, Zap, Target } from 'lucide-react';

export const IndustryShiftStats = () => {
  const stats = [
    {
      icon: TrendingDown,
      stat: '50%+',
      label: 'Drop in Organic CTR',
      description: 'Google reports dramatic decline in traditional search clicks',
      variant: 'destructive' as const
    },
    {
      icon: TrendingUp,
      stat: 'Rising Fast',
      label: 'AI Search Growth',
      description: 'ChatGPT, Gemini, Claude are becoming primary search tools',
      variant: 'default' as const
    },
    {
      icon: Zap,
      stat: '$74B',
      label: 'SEO Industry Pivot',
      description: 'Traditional SEO strategies must adapt or become obsolete',
      variant: 'default' as const
    },
    {
      icon: Target,
      stat: 'Now',
      label: 'Time to Invest',
      description: 'Once you\'re the answer, you\'re hard to displace',
      variant: 'default' as const
    }
  ];

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((item, index) => (
        <Card 
          key={index} 
          className={item.variant === 'destructive' ? 'border-destructive/30 bg-destructive/5' : 'border-primary/30'}
        >
          <CardContent className="pt-6 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <item.icon className={`h-6 w-6 ${item.variant === 'destructive' ? 'text-destructive' : 'text-primary'}`} />
            </div>
            <div className={`text-3xl font-bold ${item.variant === 'destructive' ? 'text-destructive' : 'text-primary'}`}>
              {item.stat}
            </div>
            <div className="font-semibold text-sm">{item.label}</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {item.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};