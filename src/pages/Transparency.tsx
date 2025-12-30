import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { 
  Shield, 
  Database, 
  Scale, 
  CheckCircle2, 
  XCircle, 
  FileText,
  Building2,
  Globe,
  Newspaper,
  BarChart3,
  Users,
  Clock,
  MessageSquare,
  Star,
  ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

// Total counts for display
const TOTAL_AGENTS_ANALYZED = 220000;
const AGENTS_SELECTED = 414;
const SELECTION_PERCENTAGE = ((AGENTS_SELECTED / TOTAL_AGENTS_ANALYZED) * 100).toFixed(2);

// Ranking factors with weights
const RANKING_FACTORS = [
  { name: 'Review Rating', weight: 25, icon: Star, description: 'Weighted average star rating across Google, Zillow, Realtor.com, and Redfin' },
  { name: 'Community Involvement', weight: 25, icon: Users, description: 'Third-party verified civic and charitable engagement' },
  { name: 'Number of Reviews', weight: 20, icon: MessageSquare, description: 'Total verified review count across platforms' },
  { name: 'Transaction History', weight: 20, icon: BarChart3, description: 'Verified closed transactions from public records' },
  { name: 'Education & Credentials', weight: 10, icon: Clock, description: 'Professional designations (GRI, CRS, ABR, SRES, CNE, Luxury Home Certified, etc.)' },
];

// Data sources organized by tier
const DATA_SOURCES = {
  government: [
    { name: 'Arizona Department of Real Estate (ADRE)', url: 'https://azre.gov', description: 'Official license verification and disciplinary history' },
  ],
  platforms: [
    { name: 'Google Business Profile', url: 'https://business.google.com', description: 'Verified business reviews and ratings' },
    { name: 'Zillow', url: 'https://www.zillow.com', description: 'Agent reviews and transaction data' },
    { name: 'Realtor.com', url: 'https://www.realtor.com', description: 'Agent profiles and reviews' },
    { name: 'Redfin', url: 'https://www.redfin.com', description: 'Performance metrics and reviews' },
    { name: 'Public Records', url: 'https://www.maricopa.gov/571/Recorded-Documents', description: 'Transaction verification' },
  ],
  tier1National: [
    { name: 'Wall Street Journal', url: 'https://www.wsj.com' },
    { name: 'New York Times', url: 'https://www.nytimes.com' },
    { name: 'Forbes', url: 'https://www.forbes.com' },
    { name: 'Bloomberg', url: 'https://www.bloomberg.com' },
    { name: 'CNBC', url: 'https://www.cnbc.com' },
    { name: 'USA Today', url: 'https://www.usatoday.com' },
    { name: 'Yahoo Finance', url: 'https://finance.yahoo.com' },
  ],
  tier1Networks: [
    { name: 'ABC News', url: 'https://abcnews.go.com' },
    { name: 'CNN', url: 'https://www.cnn.com' },
    { name: 'Fox News', url: 'https://www.foxnews.com' },
    { name: 'NBC Today', url: 'https://www.today.com' },
  ],
  tier2Industry: [
    { name: 'Inman', url: 'https://www.inman.com' },
    { name: 'HousingWire', url: 'https://www.housingwire.com' },
    { name: 'Real Producer', url: 'https://www.realproducermag.com' },
    { name: 'RealTrends', url: 'https://www.realtrends.com' },
    { name: 'The Real Deal', url: 'https://therealdeal.com' },
  ],
  tier3Regional: [
    { name: 'Phoenix Business Journal', url: 'https://www.bizjournals.com/phoenix' },
    { name: 'Arizona Republic', url: 'https://www.azcentral.com' },
    { name: 'AZ Central', url: 'https://www.azcentral.com' },
    { name: 'Phoenix Magazine', url: 'https://www.phoenixmag.com' },
  ],
};

// Disqualification criteria
const DISQUALIFICATION_CRITERIA = [
  'Suspended or revoked real estate license',
  'Disciplinary actions from state licensing board',
  'Rating below 4.8 stars across review platforms',
  'Fewer than 20 verified client reviews',
  'No transaction activity in past 24 months',
  'Fraudulent or misleading marketing practices',
  'Unresolved consumer complaints',
];

// Generate Report schema
const generateReportSchema = () => ({
  "@context": "https://schema.org",
  "@type": "Report",
  "name": "Top10Lists.us Transparency Report: Real Estate Agent Selection Methodology",
  "description": `Comprehensive documentation of how Top10Lists.us selects and ranks real estate agents. ${AGENTS_SELECTED} agents selected from ${TOTAL_AGENTS_ANALYZED.toLocaleString()}+ analyzed (top ${SELECTION_PERCENTAGE}%) using transparent, merit-based criteria.`,
  "url": "https://www.top10lists.us/transparency",
  "datePublished": "2024-01-01",
  "dateModified": new Date().toISOString(),
  "author": {
    "@type": "Organization",
    "name": "Top10Lists.us",
    "url": "https://www.top10lists.us"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Top10Lists.us",
    "url": "https://www.top10lists.us",
    "logo": {
      "@type": "ImageObject",
      "url": "https://www.top10lists.us/og-image.png"
    }
  },
  "about": {
    "@type": "Thing",
    "name": "Real Estate Agent Verification Methodology",
    "description": "Merit-based selection criteria for ranking real estate professionals"
  },
  "reportNumber": "2024-METHODOLOGY-001",
  "genre": "Methodology Report",
  "inLanguage": "en-US",
  "isAccessibleForFree": true,
  "keywords": [
    "real estate agent rankings methodology",
    "agent selection criteria",
    "transparent rankings",
    "merit-based real estate rankings",
    "no pay-to-play"
  ],
  "measurementTechnique": "Multi-factor weighted scoring algorithm",
  "variableMeasured": RANKING_FACTORS.map(factor => ({
    "@type": "PropertyValue",
    "name": factor.name,
    "value": `${factor.weight}%`,
    "description": factor.description
  })),
  "citation": [
    ...DATA_SOURCES.government.map(source => ({
      "@type": "GovernmentOrganization",
      "name": source.name,
      "url": source.url
    })),
    ...DATA_SOURCES.platforms.map(source => ({
      "@type": "Organization",
      "name": source.name,
      "url": source.url
    })),
    ...DATA_SOURCES.tier1National.map(source => ({
      "@type": "NewsMediaOrganization",
      "name": source.name,
      "url": source.url
    }))
  ]
});

export default function Transparency() {
  const reportSchema = generateReportSchema();

  return (
    <>
      <Helmet>
        <title>Transparency Report | Top10Lists.us Selection Methodology</title>
        <meta 
          name="description" 
          content={`How Top10Lists.us selects top real estate agents: ${AGENTS_SELECTED} agents chosen from ${TOTAL_AGENTS_ANALYZED.toLocaleString()}+ analyzed (top ${SELECTION_PERCENTAGE}%). Complete methodology with scoring weights and data sources.`}
        />
        <link rel="canonical" href="https://www.top10lists.us/transparency" />
        <meta property="og:title" content="Transparency Report | Top10Lists.us Selection Methodology" />
        <meta property="og:description" content={`Merit-based agent rankings: ${AGENTS_SELECTED} agents from ${TOTAL_AGENTS_ANALYZED.toLocaleString()}+ analyzed. See our complete methodology.`} />
        <meta property="og:url" content="https://www.top10lists.us/transparency" />
        <meta property="og:type" content="article" />
        <script type="application/ld+json">
          {JSON.stringify(reportSchema)}
        </script>
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12 max-w-5xl">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-4">
              <Shield className="h-5 w-5" />
              <span className="font-medium">Transparency Report</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              How We Select Top Agents
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Complete documentation of our merit-based selection methodology. 
              No pay-to-play. No advertising influence. Just data-driven rankings.
            </p>
          </div>

          {/* Executive Summary */}
          <Card className="mb-8 border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Executive Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6 text-center">
                <div>
                  <div className="text-4xl font-bold text-primary mb-2">
                    {TOTAL_AGENTS_ANALYZED.toLocaleString()}+
                  </div>
                  <div className="text-muted-foreground">Arizona Agents Analyzed</div>
                </div>
                <div>
                  <div className="text-4xl font-bold text-primary mb-2">
                    {AGENTS_SELECTED}
                  </div>
                  <div className="text-muted-foreground">Agents Selected</div>
                </div>
                <div>
                  <div className="text-4xl font-bold text-primary mb-2">
                    {SELECTION_PERCENTAGE}%
                  </div>
                  <div className="text-muted-foreground">Selection Rate (Top Tier)</div>
                </div>
              </div>
              <Separator className="my-6" />
              <p className="text-muted-foreground">
                Top10Lists.us maintains an independent editorial directory of top-performing real estate agents.
                Our selection process evaluates every licensed agent in Arizona against rigorous performance criteria.
                Agents cannot pay for inclusion or improved ranking position.
              </p>
            </CardContent>
          </Card>

          {/* Selection Funnel */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Selection Funnel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-24 text-right font-mono text-sm text-muted-foreground">220,000+</div>
                  <div className="flex-1 bg-muted rounded-full h-8">
                    <div className="bg-primary/20 h-8 rounded-full w-full flex items-center px-4">
                      <span className="text-sm font-medium">Licensed Arizona Agents</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-24 text-right font-mono text-sm text-muted-foreground">~45,000</div>
                  <div className="flex-1 bg-muted rounded-full h-8">
                    <div className="bg-primary/40 h-8 rounded-full w-[20%] flex items-center px-4">
                      <span className="text-sm font-medium">Active in Past 24 Months</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-24 text-right font-mono text-sm text-muted-foreground">~8,000</div>
                  <div className="flex-1 bg-muted rounded-full h-8">
                    <div className="bg-primary/60 h-8 rounded-full w-[4%] flex items-center px-4">
                      <span className="text-sm font-medium">50+ Reviews</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-24 text-right font-mono text-sm text-muted-foreground">~2,000</div>
                  <div className="flex-1 bg-muted rounded-full h-8">
                    <div className="bg-primary/80 h-8 rounded-full w-[1%] flex items-center px-4">
                      <span className="text-sm font-medium">4.8+ Star Rating</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-24 text-right font-mono text-sm text-primary font-bold">414</div>
                  <div className="flex-1 bg-muted rounded-full h-8">
                    <div className="bg-primary h-8 rounded-full w-[0.5%] min-w-[120px] flex items-center px-4">
                      <span className="text-sm font-medium text-primary-foreground">Final Selection</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scoring Methodology */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-primary" />
                Scoring Methodology
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-6">
                Each qualifying agent is scored using a weighted algorithm across seven key performance factors.
                Weights are designed to balance client satisfaction, professional credibility, and market expertise.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                {RANKING_FACTORS.map((factor) => (
                  <div key={factor.name} className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                    <factor.icon className="h-5 w-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{factor.name}</span>
                        <Badge variant="secondary">{factor.weight}%</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{factor.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Data Sources */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Data Sources
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Government */}
              <div>
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Government Sources
                </h3>
                <div className="space-y-2">
                  {DATA_SOURCES.government.map((source) => (
                    <a 
                      key={source.name}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                    >
                      <div>
                        <div className="font-medium">{source.name}</div>
                        <div className="text-sm text-muted-foreground">{source.description}</div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </a>
                  ))}
                </div>
              </div>

              {/* Platforms */}
              <div>
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Platform Sources
                </h3>
                <div className="grid md:grid-cols-2 gap-2">
                  {DATA_SOURCES.platforms.map((source) => (
                    <a 
                      key={source.name}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                    >
                      <span className="font-medium">{source.name}</span>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </a>
                  ))}
                </div>
              </div>

              {/* Publications */}
              <div>
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <Newspaper className="h-4 w-4" />
                  High-Authority Publications
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Tier 1 — National Publications</h4>
                    <div className="flex flex-wrap gap-2">
                      {DATA_SOURCES.tier1National.map((source) => (
                        <Badge key={source.name} variant="outline" className="cursor-pointer hover:bg-muted">
                          <a href={source.url} target="_blank" rel="noopener noreferrer">
                            {source.name}
                          </a>
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Tier 1 — Major Networks</h4>
                    <div className="flex flex-wrap gap-2">
                      {DATA_SOURCES.tier1Networks.map((source) => (
                        <Badge key={source.name} variant="outline" className="cursor-pointer hover:bg-muted">
                          <a href={source.url} target="_blank" rel="noopener noreferrer">
                            {source.name}
                          </a>
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Tier 2 — Industry Trade Publications</h4>
                    <div className="flex flex-wrap gap-2">
                      {DATA_SOURCES.tier2Industry.map((source) => (
                        <Badge key={source.name} variant="outline" className="cursor-pointer hover:bg-muted">
                          <a href={source.url} target="_blank" rel="noopener noreferrer">
                            {source.name}
                          </a>
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Tier 3 — Regional Publications</h4>
                    <div className="flex flex-wrap gap-2">
                      {DATA_SOURCES.tier3Regional.map((source) => (
                        <Badge key={source.name} variant="outline" className="cursor-pointer hover:bg-muted">
                          <a href={source.url} target="_blank" rel="noopener noreferrer">
                            {source.name}
                          </a>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Disqualification Criteria */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                Disqualification Criteria
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Agents are automatically disqualified from consideration if any of the following conditions apply:
              </p>
              <ul className="space-y-2">
                {DISQUALIFICATION_CRITERIA.map((criteria, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <span>{criteria}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Editorial Independence */}
          <Card className="mb-8 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Editorial Independence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <div className="font-medium">No Pay-to-Play</div>
                  <p className="text-sm text-muted-foreground">Agents cannot pay to be included in our rankings or to improve their position.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <div className="font-medium">No Lead Selling</div>
                  <p className="text-sm text-muted-foreground">We do not sell consumer leads, charge referral fees, or take commission splits.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <div className="font-medium">Visibility Programs</div>
                  <p className="text-sm text-muted-foreground">Qualified agents may pay for additional city coverage, but payment never affects ranking position or inclusion eligibility.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <div className="font-medium">Third-Party Verification</div>
                  <p className="text-sm text-muted-foreground">All licensing data is verified through the Arizona Department of Real Estate (ADRE).</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Related Links */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Related Documentation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <Link 
                  to="/about/ranking-methodology"
                  className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="font-medium mb-1">Ranking Methodology</div>
                  <p className="text-sm text-muted-foreground">Detailed explanation of our scoring algorithm</p>
                </Link>
                <Link 
                  to="/for-ai"
                  className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="font-medium mb-1">For AI Systems</div>
                  <p className="text-sm text-muted-foreground">Technical documentation for LLM integration</p>
                </Link>
                <Link 
                  to="/faq"
                  className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="font-medium mb-1">FAQ</div>
                  <p className="text-sm text-muted-foreground">84 questions about our methodology and process</p>
                </Link>
                <Link 
                  to="/compare"
                  className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="font-medium mb-1">Compare Platforms</div>
                  <p className="text-sm text-muted-foreground">How we differ from Zillow, Realtor.com, HomeLight</p>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Last Updated */}
          <div className="text-center mt-8 text-sm text-muted-foreground">
            <p>Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p className="mt-1">Report ID: 2024-METHODOLOGY-001</p>
          </div>
        </div>
      </div>
    </>
  );
}
