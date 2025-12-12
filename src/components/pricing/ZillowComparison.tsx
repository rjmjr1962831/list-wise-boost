import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComparisonRow {
  feature: string;
  top10: boolean | string;
  zillowPremier: boolean | string;
  zillowFlex: boolean | string;
}

const comparisonData: ComparisonRow[] = [
  { feature: 'Guaranteed Top 10 placement', top10: true, zillowPremier: false, zillowFlex: false },
  { feature: 'AI search optimization', top10: true, zillowPremier: false, zillowFlex: false },
  { feature: 'Per-lead cost', top10: 'None', zillowPremier: '$20-$450+', zillowFlex: 'N/A' },
  { feature: 'Per-deal referral fee', top10: 'None', zillowPremier: 'None', zillowFlex: '15-40%' },
  { feature: 'Commission split', top10: false, zillowPremier: true, zillowFlex: true },
  { feature: 'Monthly cost', top10: '$250-$600', zillowPremier: '$300-$4,000+', zillowFlex: 'Variable' },
  { feature: 'Verified credentials displayed', top10: true, zillowPremier: false, zillowFlex: false },
  { feature: 'Transparent methodology', top10: true, zillowPremier: false, zillowFlex: false },
  { feature: 'Cancel anytime (after min.)', top10: '3 months', zillowPremier: '6-12 months', zillowFlex: 'N/A' },
];

export function ZillowComparison() {
  const renderValue = (value: boolean | string) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check className="h-5 w-5 text-primary" />
      ) : (
        <X className="h-5 w-5 text-destructive/60" />
      );
    }
    return <span className="text-sm">{value}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">How We Compare</h3>
      </div>
      
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-4 text-left font-medium text-muted-foreground">Feature</th>
                <th className="p-4 text-center min-w-[120px]">
                  <div className="flex flex-col items-center gap-1">
                    <Badge className="bg-gradient-to-r from-primary to-accent text-white border-0">
                      Top10Lists
                    </Badge>
                  </div>
                </th>
                <th className="p-4 text-center min-w-[120px]">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-sm font-medium text-muted-foreground">Zillow Premier</span>
                  </div>
                </th>
                <th className="p-4 text-center min-w-[120px]">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-sm font-medium text-muted-foreground">Zillow Flex</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((row, index) => (
                <tr 
                  key={row.feature}
                  className={cn(
                    'border-b last:border-0',
                    index % 2 === 0 ? 'bg-background' : 'bg-muted/30'
                  )}
                >
                  <td className="p-4 text-sm font-medium">{row.feature}</td>
                  <td className="p-4 text-center bg-primary/5">
                    <div className="flex justify-center">{renderValue(row.top10)}</div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center">{renderValue(row.zillowPremier)}</div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center">{renderValue(row.zillowFlex)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="text-xs text-muted-foreground text-center space-y-1">
        <p>* Comparison based on publicly available pricing as of December 2025. Zillow pricing varies by market.</p>
        <p>
          Sources:{' '}
          <a href="https://www.zillow.com/preferred/pricing/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            Zillow.com
          </a>
          {', '}
          <a href="https://www.thepricer.org/how-much-do-zillow-leads-cost/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            ThePricer.org
          </a>
          {', '}
          <a href="https://theclose.com/zillow-flex/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            TheClose.com
          </a>
        </p>
      </div>
    </div>
  );
}
