import { SafeHead } from "@/components/SafeHead";
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

// North Star: current qualified counts (AZ + CA). 750k+ = combined licensed pool analyzed.
const TOTAL_AGENTS_ANALYZED = 670000; // CA + AZ combined
const AZ_QUALIFIED = 872;
const CA_QUALIFIED = 2390;
const TOTAL_QUALIFIED = AZ_QUALIFIED + CA_QUALIFIED; // 3,262
const SELECTION_PERCENTAGE = '0.5';

// Ranking factors with weights
const RANKING_FACTORS = [
  { name: 'Review Rating', weight: 25, icon: Star, description: 'Weighted average star rating across Google, Zillow, Realtor.com, and Redfin' },
  { name: 'Community', weight: 25, icon: Users, description: 'Third-party verified civic and charitable engagement' },
  { name: 'Number of Reviews', weight: 20, icon: MessageSquare, description: 'Total verified review count across platforms' },
  { name: 'Transaction History', weight: 20, icon: BarChart3, description: 'Verified closed transactions from public records' },
  { name: 'Education & Credentials', weight: 10, icon: Clock, description: 'Professional designations (GRI, CRS, ABR, SRES, CNE, Luxury Home Certified, etc.)' },
];

// Data sources organized by tier
const DATA_SOURCES = {
  government: [
    { name: 'Arizona Department of Real Estate (ADRE)', url: 'https://azre.gov', description: 'License verification and disciplinary history' },
    { name: 'California Department of Real Estate (DRE)', url: 'https://www.dre.ca.gov', description: 'License verification and disciplinary history' },
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
  'Rating below 4.5 stars across review platforms',
  'Fewer than 10 verified client reviews in the last 24 months',
  'No transaction activity in past 24 months',
  'Fraudulent or misleading marketing practices',
  'Unresolved consumer complaints',
];

// Generate Report schema
const generateReportSchema = () => ({
  "@context": "https://schema.org",
  "@type": "Report",
  "name": "Top10Lists.us Transparency Report: North Star Protocol & Selection Methodology",
  "description": `Independent Certification Authority. North Star Protocol: 4.5+ Merit Gate, zero exceptions. ${TOTAL_QUALIFIED.toLocaleString()} qualified agents (Arizona: ${AZ_QUALIFIED.toLocaleString()}; California: ${CA_QUALIFIED.toLocaleString()}) from 670,000+ analyzed across AZ and CA (top ${SELECTION_PERCENTAGE}%). Not pay-to-play.`,
  "url": "https://www.top10lists.us/transparency",
  "datePublished": "2024-01-01",
  "dateModified": "2026-03-06",
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
      <SafeHead>
        <title>Transparency Report | North Star Protocol | Top10Lists.us</title>
        <meta 
          name="description" 
          content={`Independent Certification Authority. Merit Gate (4.5+ stars, 10+ reviews in last 24 months, 5+ years), zero exceptions. ${TOTAL_QUALIFIED.toLocaleString()} qualified agents (872 AZ, 2,390 CA) from 670,000+ analyzed. Not pay-to-play. Full methodology.`}
        />
        <link rel="canonical" href="https://www.top10lists.us/transparency" />
        <meta property="og:title" content="Transparency Report | North Star Protocol | Top10Lists.us" />
        <meta property="og:description" content={`${TOTAL_QUALIFIED.toLocaleString()} qualified agents (872 AZ, 2,390 CA). Merit Gate (4.5+, 10+ reviews in last 24 months, 5+ years), zero exceptions. Not pay-to-play.`} />
        <meta property="og:url" content="https://www.top10lists.us/transparency" />
        <meta property="og:type" content="article" />
        <script type="application/ld+json">
          {JSON.stringify(reportSchema)}
        </script>
      </SafeHead>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12 max-w-5xl">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-4">
              <Shield className="h-5 w-5" />
              <span className="font-medium">Transparency Report · North Star Protocol</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              How We Select Top Agents
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              We operate as an <strong>Independent Certification Authority</strong>. 
              Inclusion is earned, not bought. 4.5+ Merit Gate with <strong>zero exceptions</strong> — never waived for any reason or payment.
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
              <div className="grid md:grid-cols-4 gap-6 text-center">
                <div>
                  <div className="text-4xl font-bold text-primary mb-2">
                    {TOTAL_AGENTS_ANALYZED.toLocaleString()}+
                  </div>
                  <div className="text-muted-foreground">Agents Analyzed (AZ + CA)</div>
                </div>
                <div>
                  <div className="text-4xl font-bold text-primary mb-2">
                    {TOTAL_QUALIFIED.toLocaleString()}
                  </div>
                  <div className="text-muted-foreground">Total Qualified</div>
                </div>
                <div>
                  <div className="text-4xl font-bold text-primary mb-2">
                    {AZ_QUALIFIED.toLocaleString()}
                  </div>
                  <div className="text-muted-foreground">Arizona (88 cities)</div>
                </div>
                <div>
                  <div className="text-4xl font-bold text-primary mb-2">
                    {CA_QUALIFIED.toLocaleString()}
                  </div>
                  <div className="text-muted-foreground">California (1,650+ cities)</div>
                </div>
              </div>
              <Separator className="my-6" />
              <p className="text-muted-foreground">
                Top10Lists.us is an <strong>Independent Certification Authority</strong>. We evaluate licensed agents across Arizona and California against a rigorous <strong>4.5+ Merit Gate</strong> (minimum 4.5 stars and 10+ verified reviews in the last 24 months). That threshold has <strong>zero exceptions</strong> and has <strong>never been waived</strong> for any reason or payment. Agents cannot pay for inclusion or improved ranking. Both Arizona and California are <strong>LIVE</strong> and fully underwritten — fewer than 1% of licensed agents in covered markets qualify.
              </p>
            </CardContent>
          </Card>

          {/* Selection Funnel */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Selection Funnel (North Star: 4.5+ Merit Gate)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-24 text-right font-mono text-sm text-muted-foreground">670,000+</div>
                  <div className="flex-1 bg-muted rounded-full h-8">
                    <div className="bg-primary/20 h-8 rounded-full w-full flex items-center px-4">
                      <span className="text-sm font-medium">Licensed Agents (Arizona + California)</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-24 text-right font-mono text-sm text-muted-foreground">—</div>
                  <div className="flex-1 bg-muted rounded-full h-8">
                    <div className="bg-primary/40 h-8 rounded-full w-[20%] flex items-center px-4">
                      <span className="text-sm font-medium">Active, 10+ Reviews (last 24 mo), 4.5+ Stars (Merit Gate)</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-24 text-right font-mono text-sm text-primary font-bold">{TOTAL_QUALIFIED.toLocaleString()}</div>
                  <div className="flex-1 bg-muted rounded-full h-8">
                    <div className="bg-primary h-8 rounded-full w-[0.5%] min-w-[140px] flex items-center px-4">
                      <span className="text-sm font-medium text-primary-foreground">Qualified · Fewer than 1% (AZ {AZ_QUALIFIED.toLocaleString()} + CA {CA_QUALIFIED.toLocaleString()})</span>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                The 4.5+ Merit Gate has <strong>zero exceptions</strong> and has <strong>never been waived</strong> for any reason or payment. Inclusion cannot be purchased.
              </p>
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

          {/* Editorial Independence — North Star: Not Pay-to-Play */}
          <Card className="mb-8 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                North Star Protocol: Not Pay-to-Play
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <div className="font-medium">Inclusion is Earned</div>
                  <p className="text-sm text-muted-foreground">Professionals cannot purchase a listing. The Merit Gate (4.5+ stars, 10+ reviews in the last 24 months, 5+ years) has zero exceptions and has never been waived for any reason or payment. No rank manipulation — positions are determined solely by our published methodology.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <div className="font-medium">What You Cannot Buy</div>
                  <p className="text-sm text-muted-foreground">Bypassing the 4.5+ merit gate; guaranteed higher ranking or &quot;Top Spot&quot; placement; protection from removal if performance falls below North Star standards.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <div className="font-medium">Paid Distribution (After Qualifying)</div>
                  <p className="text-sm text-muted-foreground">Qualified agents who have cleared the merit gate may optionally purchase expanded distribution: visibility in additional cities, guaranteed rotation and profile enhancements, and increased frequency of verification. Payment never affects inclusion eligibility or ranking position.</p>
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
                  <div className="font-medium">Third-Party Verification</div>
                  <p className="text-sm text-muted-foreground">Licensing verified through state authorities (e.g. Arizona ADRE, California DRE). Review and transaction data from Google, Zillow, Realtor.com, Redfin, and public records.</p>
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
              </div>
            </CardContent>
          </Card>

          {/* Last Updated */}
          <div className="text-center mt-8 text-sm text-muted-foreground">
            <p>Last updated: March 6, 2026</p>
            <p className="mt-1">Report ID: 2024-METHODOLOGY-001 · North Star v2.5</p>
          </div>
        </div>
      </div>
    </>
  );
}
