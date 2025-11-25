import { Card, CardContent } from '@/components/ui/card';
import { TrendingDown, Sparkles, X, Check } from 'lucide-react';

export const AISearchComparison = () => {
  return (
    <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
      {/* Old SEO */}
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="pt-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-destructive/20">
            <div className="h-12 w-12 rounded-lg bg-destructive/10 flex items-center justify-center">
              <TrendingDown className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Old SEO Strategy</h3>
              <p className="text-sm text-muted-foreground">Losing Effectiveness</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <X className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Keyword Stuffing</p>
                <p className="text-xs text-muted-foreground">LLMs ignore repetitive keywords</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <X className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Hundreds of Backlinks</p>
                <p className="text-xs text-muted-foreground">Quantity over quality no longer works</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <X className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Generic Content</p>
                <p className="text-xs text-muted-foreground">Blogs and social posts carry little weight</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <X className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">JavaScript-Heavy Sites</p>
                <p className="text-xs text-muted-foreground">LLMs struggle to parse dynamic content</p>
              </div>
            </div>
          </div>

          <div className="bg-destructive/10 rounded-lg p-4 text-center">
            <p className="text-sm font-semibold text-destructive">
              Legacy sites like Zillow are losing traffic
            </p>
          </div>
        </CardContent>
      </Card>

      {/* AI Search */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-primary/20">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-bold">AI Search Optimization</h3>
              <p className="text-sm text-muted-foreground">The New Standard</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Structured Data</p>
                <p className="text-xs text-muted-foreground">LLM-friendly list formats</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Authoritative Citations</p>
                <p className="text-xs text-muted-foreground">Major publication mentions</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Clean, Semantic HTML</p>
                <p className="text-xs text-muted-foreground">Built for AI parsing from day one</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Curated Lists</p>
                <p className="text-xs text-muted-foreground">LLMs love authoritative rankings</p>
              </div>
            </div>
          </div>

          <div className="bg-primary/10 rounded-lg p-4 text-center">
            <p className="text-sm font-semibold text-primary">
              Built AI-first, not retrofitted
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};