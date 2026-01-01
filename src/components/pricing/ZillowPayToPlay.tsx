import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  DollarSign, 
  Lock, 
  EyeOff, 
  Award,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Percent,
  Clock,
  Shield,
  ExternalLink
} from 'lucide-react';

export function ZillowPayToPlay() {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <Badge variant="outline" className="border-destructive/50 text-destructive">
          Industry Truth
        </Badge>
        <h3 className="text-xl font-bold text-foreground">
          Zillow's "Top Agent" Badge Is Pay-to-Play
        </h3>
        <p className="text-sm text-muted-foreground max-w-xl mx-auto">
          Understanding the real structure behind the badge
        </p>
      </div>

      {/* The Real Cost of Zillow - NEW SECTION */}
      <Card className="overflow-hidden border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="h-5 w-5 text-amber-600" />
            <h4 className="font-bold text-foreground">The Real Cost of Zillow</h4>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            {/* Premier Agent Pricing */}
            <div className="p-4 bg-background rounded-lg border">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="text-xs">Premier Agent</Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Per lead cost:</span>
                  <span className="font-semibold text-destructive">$20 - $450+</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Monthly spend:</span>
                  <span className="font-semibold text-destructive">$300 - $4,000+</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Luxury ZIP codes can exceed $450/lead
                </p>
              </div>
            </div>

            {/* Flex Pricing */}
            <div className="p-4 bg-background rounded-lg border">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="text-xs">Zillow Flex</Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Seller leads:</span>
                  <span className="font-semibold text-destructive">40% commission</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Overall range:</span>
                  <span className="font-semibold text-destructive">15% - 40%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Invitation-only for top Premier Agents
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* The Zillow Funnel Visualization */}
      <Card className="overflow-hidden border-destructive/20 bg-destructive/5">
        <CardContent className="p-6 space-y-6">
          {/* Step 1: Pay to Enter */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                Step 1: Pay to Enter
                <Badge variant="destructive" className="text-xs">Required</Badge>
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                Must be a <span className="font-medium">Premier Agent</span> ($300-$4,000+/mo) 
                or agree to <span className="font-medium text-destructive">15-40% referral fee</span> (Flex program)
              </p>
              <div className="mt-2 p-2 bg-background/50 rounded text-xs text-muted-foreground flex items-center gap-2">
                <EyeOff className="h-4 w-4" />
                <span>If you don't pay, you're invisible to Zillow's scoring</span>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>

          {/* Step 2: Get Scored */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
              <Clock className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-foreground">Step 2: Performance Metrics (After Paying)</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                {['Response time', 'Follow-up speed', 'Lead conversion', 'CSAT scores', 'Pipeline updates', 'Appointment setting'].map((metric) => (
                  <div key={metric} className="text-xs px-2 py-1 bg-background/50 rounded text-muted-foreground">
                    {metric}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2 italic">
                These metrics maximize Zillow's revenue, not agent quality
              </p>
            </div>
          </div>

          <div className="flex justify-center">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>

          {/* Step 3: Badge Awarded */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
              <Award className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-foreground">"Top Agent" Badge = Best at Converting Zillow Leads</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Not a ranking of the best agents in your city—just the best performers 
                <span className="font-medium"> among Zillow's paying customers</span>.
              </p>
            </div>
          </div>

          {/* 40% Revenue Box */}
          <div className="mt-4 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
            <div className="flex items-center gap-3">
              <Percent className="h-8 w-8 text-destructive" />
              <div>
                <p className="font-bold text-destructive text-lg">Up to 40% Commission Split</p>
                <p className="text-xs text-muted-foreground">
                  Zillow takes 15-40% of your commission on closed deals from Flex leads (40% for seller leads)
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* What Their Badge Does NOT Measure */}
      <Card className="border-muted">
        <CardContent className="p-4">
          <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <XCircle className="h-4 w-4 text-destructive" />
            What Zillow's Badge Does NOT Measure
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              'Agent reviews',
              'Years of experience',
              'Community involvement',
              'Verified credentials',
              'Multi-platform ratings',
              'Actual market expertise'
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                <XCircle className="h-3 w-3 text-destructive/60 flex-shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Side by Side Comparison */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Zillow Side */}
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-destructive/20 flex items-center justify-center">
                <Lock className="h-4 w-4 text-destructive" />
              </div>
              <span className="font-semibold text-foreground">Zillow's "Top Agent"</span>
            </div>
            <div className="space-y-2">
              {[
                { text: 'Pay-to-play entry ($300-$4,000+/mo)', bad: true },
                { text: 'Or 15-40% commission split', bad: true },
                { text: 'Only evaluates paying agents', bad: true },
                { text: 'Metrics maximize Zillow revenue', bad: true },
                { text: 'Not a measure of agent quality', bad: true },
                { text: 'Not transparent methodology', bad: true },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                  <span className="text-muted-foreground">{item.text}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top10Lists Side */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <span className="font-semibold text-foreground">Top10Lists.us</span>
            </div>
            <div className="space-y-2">
              {[
                'Invitation-only (top 0.5% qualify)',
                'Multi-source verified data',
                'Transparent methodology',
                'Independent rankings',
                'Community involvement weighted',
                'AI-optimized for citations',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sources with clickable links */}
      <div className="space-y-2 pt-2 border-t">
        <p className="text-xs font-medium text-muted-foreground">Sources:</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <a 
            href="https://www.zillow.com/preferred/pricing/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            Zillow Flex Pricing (Official)
            <ExternalLink className="h-3 w-3" />
          </a>
          <a 
            href="https://www.thepricer.org/how-much-do-zillow-leads-cost/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            ThePricer.org Lead Cost Analysis
            <ExternalLink className="h-3 w-3" />
          </a>
          <a 
            href="https://theclose.com/zillow-flex/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            TheClose.com Flex Breakdown
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
