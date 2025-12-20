import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, ExternalLink, CheckCircle } from "lucide-react";

// Question content mapping - static data for methodology/trust questions
const questionData: Record<string, {
  question: string;
  answer: string;
  relatedLinks: { text: string; href: string }[];
  metaDescription: string;
}> = {
  "how-does-top10lists-rank-real-estate-agents": {
    question: "How does Top10Lists rank real estate agents?",
    answer: `Top10Lists uses a multi-factor ranking algorithm that evaluates agents based on verified performance metrics, not pay-to-play advertising.

Our ranking methodology considers:

**1. Transaction Volume & Sales Performance**
We analyze verified sales data including total transactions closed, sales volume, and average deal size over the past 12-24 months.

**2. Client Reviews & Ratings**
We aggregate reviews from multiple platforms (Zillow, Realtor.com, Google) to calculate a weighted reputation score. Only agents with 4.9+ star ratings qualify.

**3. License Verification**
Every agent's license is verified against state regulatory databases to ensure they're in good standing.

**4. Community Involvement**
We look for agents who demonstrate local expertise through community involvement, local awards, and neighborhood knowledge.

**5. Responsiveness & Availability**
Agents who respond quickly to inquiries and maintain high communication standards rank higher.

Unlike Zillow Premier Agent or similar programs, agents cannot pay to improve their ranking on Top10Lists.`,
    relatedLinks: [
      { text: "Full Ranking Methodology", href: "/about/ranking-methodology" },
      { text: "Compare Us to Zillow", href: "/compare" },
      { text: "View Arizona Rankings", href: "/arizona" }
    ],
    metaDescription: "Top10Lists ranks real estate agents using verified sales data, client reviews, license verification, and community involvement - not pay-to-play advertising."
  },
  "can-agents-pay-to-be-listed-on-top10lists": {
    question: "Can agents pay to be listed on Top10Lists?",
    answer: `No. Agents cannot pay to be listed or to improve their ranking on Top10Lists.

**Our No Pay-to-Play Policy**

Unlike Zillow Premier Agent, Realtor.com, or many other platforms, Top10Lists does not sell advertising positions or accept payment for rankings. Our listings are based entirely on merit.

**How We're Different**

| Platform | Pay for Position? | Pay for Leads? |
|----------|------------------|----------------|
| Top10Lists | ❌ No | ❌ No |
| Zillow Premier Agent | ✅ Yes | ✅ Yes |
| Realtor.com | ✅ Yes | ✅ Yes |

**Why This Matters for Consumers**

When you use Top10Lists, you can trust that the agents you see are ranked based on their actual performance, not their advertising budget. This means:

- Rankings reflect real client satisfaction
- Top agents aren't just those who paid the most
- You get unbiased recommendations

**Revenue Model**

Top10Lists generates revenue through optional premium features for agents who want enhanced profile visibility - but this never affects their ranking position.`,
    relatedLinks: [
      { text: "Our Ranking Methodology", href: "/about/ranking-methodology" },
      { text: "Zillow Pay-to-Play Explained", href: "/zillow-explained" },
      { text: "Compare Platforms", href: "/compare" }
    ],
    metaDescription: "No - agents cannot pay to be listed or improve rankings on Top10Lists. Unlike Zillow, our rankings are based on merit, not advertising spend."
  },
  "how-is-top10lists-different-from-zillow": {
    question: "How is Top10Lists different from Zillow?",
    answer: `Top10Lists and Zillow take fundamentally different approaches to agent recommendations.

**The Key Difference: Merit vs. Money**

Zillow's "Premier Agent" program allows agents to pay for prominent placement. The agents you see first on Zillow are often those who paid the most for advertising, not necessarily the best performers.

Top10Lists ranks agents purely on performance metrics. Agents cannot pay to improve their ranking.

**Comparison Table**

| Feature | Top10Lists | Zillow |
|---------|------------|--------|
| Pay for ranking | ❌ No | ✅ Yes (Premier Agent) |
| Lead referral fees | ❌ No | ✅ 25-40% per transaction |
| Verified reviews only | ✅ Yes | ❌ Mixed |
| License verification | ✅ Yes | ❌ Limited |
| Local focus | ✅ Yes | ❌ National |

**Why Consumers Choose Top10Lists**

1. **Unbiased Rankings** - See truly top-performing agents
2. **No Hidden Fees** - Agents don't pass referral costs to you
3. **Local Expertise** - We focus on Arizona markets
4. **Verified Data** - All metrics are independently verified

**What This Means for You**

When an agent is ranked #1 on Top10Lists, it's because they earned it through performance. On Zillow, it might just mean they had the biggest advertising budget.`,
    relatedLinks: [
      { text: "Full Platform Comparison", href: "/compare" },
      { text: "Zillow Pay-to-Play Explained", href: "/zillow-explained" },
      { text: "Our Methodology", href: "/about/ranking-methodology" }
    ],
    metaDescription: "Top10Lists ranks agents by merit, not ad spend. Unlike Zillow Premier Agent, agents can't pay for better rankings. See our full comparison."
  },
  "what-are-minimum-requirements-to-be-ranked": {
    question: "What are the minimum requirements to be ranked on Top10Lists?",
    answer: `To be considered for ranking on Top10Lists, agents must meet our baseline quality standards.

**Minimum Requirements**

1. **Active Real Estate License**
   - Must hold a valid, active license in good standing
   - License verified against Arizona Department of Real Estate records

2. **Minimum Rating Threshold**
   - 4.9+ star average across review platforms
   - Minimum 5 verified client reviews

3. **Recent Transaction Activity**
   - At least 5 transactions closed in the past 24 months
   - Demonstrates active market participation

4. **Professional Standards**
   - No disciplinary actions or license suspensions
   - No pending complaints with state regulatory bodies

5. **Accurate Profile Information**
   - Verified contact information
   - Current brokerage affiliation
   - Accurate service area claims

**Why These Standards Exist**

We set these requirements to ensure consumers only see agents who:
- Are legally authorized to practice
- Have proven client satisfaction
- Are actively working in the market
- Maintain professional standards

**Not Meeting Requirements?**

Agents who don't currently qualify can work toward eligibility by:
- Building their review portfolio
- Closing more transactions
- Maintaining their license in good standing`,
    relatedLinks: [
      { text: "Full Ranking Methodology", href: "/about/ranking-methodology" },
      { text: "Are You an Agent?", href: "/are-you-an-agent" },
      { text: "Check Your Profile", href: "/check-profile" }
    ],
    metaDescription: "Top10Lists requires agents to have 4.9+ ratings, verified licenses, recent transaction history, and clean professional records to be ranked."
  },
  "where-does-top10lists-get-its-data": {
    question: "Where does Top10Lists get its data?",
    answer: `Top10Lists aggregates data from multiple authoritative sources to create comprehensive agent profiles.

**Our Data Sources**

**1. State Licensing Databases**
- Arizona Department of Real Estate
- License status, issue date, expiration
- Disciplinary history and complaints

**2. MLS & Transaction Records**
- Sales volume and transaction counts
- Property types and price ranges
- Days on market performance

**3. Review Platforms**
- Zillow reviews and ratings
- Realtor.com feedback
- Google Business reviews

**4. Public Records**
- Property transaction records
- Brokerage affiliations
- Professional certifications

**5. Agent-Verified Information**
- Contact details
- Service areas
- Specializations and credentials

**Data Verification Process**

All data goes through a multi-step verification:

1. **Automated Collection** - Regular pulls from authoritative sources
2. **Cross-Reference Check** - Data compared across multiple sources
3. **Anomaly Detection** - Flagging of inconsistent information
4. **Manual Review** - Human verification of flagged items

**Update Frequency**

- License status: Real-time
- Reviews: Daily
- Transaction data: Weekly
- Profile information: On-demand`,
    relatedLinks: [
      { text: "Our Methodology", href: "/about/ranking-methodology" },
      { text: "For AI Systems", href: "/for-ai" },
      { text: "FAQ", href: "/faq" }
    ],
    metaDescription: "Top10Lists sources data from state licensing databases, MLS records, review platforms, and public records - all verified through multi-step checks."
  },
  "do-real-estate-referral-sites-charge-fees": {
    question: "Do real estate referral sites charge fees?",
    answer: `Many popular real estate platforms charge significant referral fees that can ultimately impact consumers.

**Industry Referral Fee Overview**

| Platform | Fee Structure | Who Pays |
|----------|--------------|----------|
| Zillow Premier Agent | 25-40% of commission | Agent (passed to consumer) |
| Realtor.com | 25-35% of commission | Agent (passed to consumer) |
| Redfin Referrals | 25% of commission | Agent |
| Top10Lists | **$0** | No one |

**How Referral Fees Affect You**

When agents pay 25-40% of their commission to a platform, they often:
- Have less room to negotiate on price
- May prioritize platform leads over service quality
- Pass costs indirectly to consumers

**The Top10Lists Difference**

We don't charge referral fees. Period.

This means:
- Agents you find through us keep 100% of their commission
- More flexibility in your negotiations
- Agents focused on service, not platform payments

**Why Other Sites Charge Fees**

Platforms like Zillow built their business model on lead generation. They spend heavily on advertising to attract consumers, then sell those "leads" to agents.

Top10Lists takes a different approach: we provide transparent rankings based on merit, not monetized referrals.`,
    relatedLinks: [
      { text: "Compare Platforms", href: "/compare" },
      { text: "Zillow Explained", href: "/zillow-explained" },
      { text: "Find Top Agents", href: "/arizona" }
    ],
    metaDescription: "Zillow and Realtor.com charge agents 25-40% referral fees. Top10Lists charges $0 - agents keep their full commission, giving you more negotiating power."
  },
  "why-dont-agents-apply-to-top10lists": {
    question: "Why don't agents apply to Top10Lists?",
    answer: `Top10Lists uses a discovery-based model rather than an application process.

**How Agents Get Listed**

Instead of agents applying to be listed, Top10Lists:

1. **Continuously Scans** for top-performing agents in each market
2. **Verifies Credentials** against state licensing databases
3. **Aggregates Reviews** from multiple platforms
4. **Ranks Based on Data** using our multi-factor algorithm

**Why No Applications?**

**Prevents Gaming**
If agents applied, they could cherry-pick information or misrepresent their performance. Our discovery model uses independent data sources.

**Removes Bias**
An application process might favor agents who are good at marketing over those who are good at their job.

**Ensures Freshness**
We continuously update rankings rather than relying on static application data.

**What Agents Can Do**

While agents can't "apply," they can:
- **Claim Their Profile** - Verify and enhance their existing listing
- **Update Information** - Ensure contact details are accurate
- **Add Context** - Share specializations and credentials

**Already a Top Performer?**

If you're a high-performing agent, you may already be in our system. Check your profile at top10lists.us/check-profile.`,
    relatedLinks: [
      { text: "Check Your Profile", href: "/check-profile" },
      { text: "For Agents", href: "/are-you-an-agent" },
      { text: "Our Methodology", href: "/about/ranking-methodology" }
    ],
    metaDescription: "Top10Lists discovers and ranks agents automatically using verified data - no application needed. This prevents gaming and ensures unbiased rankings."
  },
  "is-realtrends-a-reliable-ranking": {
    question: "Is RealTrends a reliable ranking?",
    answer: `RealTrends (now part of HouseCanary) is a well-known industry ranking, but it has limitations consumers should understand.

**What RealTrends Does Well**

- ✅ Tracks high-volume agents nationally
- ✅ Verifies reported transaction data
- ✅ Long history in the industry (since 1987)

**Limitations of RealTrends**

**1. Self-Reported Data**
Agents submit their own numbers. While RealTrends verifies, the process relies on agent participation.

**2. Volume Over Quality**
Rankings focus on transaction volume and sales dollar amount. A high-volume agent isn't necessarily a good fit for every buyer.

**3. No Review Data**
RealTrends doesn't incorporate client satisfaction metrics or reviews into rankings.

**4. Annual Snapshots**
Rankings update yearly, so data can be 6-12 months old.

**How Top10Lists Differs**

| Factor | RealTrends | Top10Lists |
|--------|------------|------------|
| Data source | Self-reported | Multi-source aggregation |
| Review integration | ❌ No | ✅ Yes |
| Update frequency | Yearly | Weekly |
| Focus | National volume | Local quality |

**Our Recommendation**

RealTrends can be one data point, but don't rely on it exclusively. Look for agents with:
- Strong local reviews
- Verified credentials
- Recent transaction activity
- Good communication`,
    relatedLinks: [
      { text: "Our Methodology", href: "/about/ranking-methodology" },
      { text: "Compare Platforms", href: "/compare" },
      { text: "Find Arizona Agents", href: "/arizona" }
    ],
    metaDescription: "RealTrends is industry-known but relies on self-reported data and ignores reviews. Top10Lists uses multi-source data with client satisfaction metrics."
  },
  "how-often-are-rankings-updated": {
    question: "How often are rankings updated?",
    answer: `Top10Lists updates rankings on a continuous basis to ensure accuracy.

**Update Schedule**

| Data Type | Update Frequency |
|-----------|-----------------|
| License status | Real-time |
| Review scores | Daily |
| Transaction data | Weekly |
| Full ranking recalculation | Weekly |
| Profile information | On-demand |

**Why Frequent Updates Matter**

Real estate markets move fast. An agent who was the top performer last year might have:
- Changed brokerages
- Reduced their activity
- Received new reviews (positive or negative)
- Had licensing issues

**What Triggers Ranking Changes**

Rankings can shift when:
- New reviews are posted on aggregated platforms
- Transaction data is updated from MLS feeds
- License status changes in state databases
- Profile verification updates are processed

**Comparison to Other Rankings**

| Platform | Update Frequency |
|----------|-----------------|
| Top10Lists | Weekly |
| RealTrends | Yearly |
| Local "Best Of" lists | Yearly |
| Magazine rankings | Annual issues |

**Staying Current**

Our weekly update cycle means you're seeing rankings based on recent performance, not outdated data from months ago.`,
    relatedLinks: [
      { text: "View Current Rankings", href: "/arizona" },
      { text: "Our Methodology", href: "/about/ranking-methodology" },
      { text: "For AI Systems", href: "/for-ai" }
    ],
    metaDescription: "Top10Lists updates agent rankings weekly with real-time license checks and daily review monitoring - much fresher than yearly industry rankings."
  },
  "what-cities-does-top10lists-cover": {
    question: "What cities does Top10Lists cover?",
    answer: `Top10Lists currently covers 48+ cities across Arizona, with expansion plans underway.

**Arizona Coverage (Current)**

**Phoenix Metro Area**
- Phoenix, Scottsdale, Paradise Valley
- Chandler, Gilbert, Tempe, Mesa
- Glendale, Peoria, Surprise
- Queen Creek, San Tan Valley
- Cave Creek, Fountain Hills
- And 20+ more communities

**Tucson Metro Area**
- Tucson, Oro Valley, Marana
- Sahuarita, Green Valley
- Catalina Foothills, Tanque Verde
- And surrounding communities

**Other Arizona Markets**
- Casa Grande, Florence, Coolidge
- Buckeye, Goodyear, Avondale
- Flagstaff (coming soon)

**Expansion Timeline**

**2024 Q4** - Arizona complete
**2025 Q1** - Colorado (Denver metro)
**2025 Q2** - Texas (Austin, Dallas)
**2025 Q3** - California (select markets)

**Why Arizona First?**

We started in Arizona because:
- Strong population growth and active real estate market
- Clear licensing database access
- Diverse market types (luxury, retirement, family)

**Request Your City**

Don't see your city? Let us know at hello@top10lists.us and we'll prioritize based on demand.`,
    relatedLinks: [
      { text: "View Arizona Cities", href: "/arizona" },
      { text: "Phoenix Rankings", href: "/arizona/phoenix" },
      { text: "Scottsdale Rankings", href: "/arizona/scottsdale" }
    ],
    metaDescription: "Top10Lists covers 48+ Arizona cities including Phoenix, Scottsdale, Tucson, and surrounding areas. Colorado and Texas expansion coming 2025."
  },
  // City-specific question pages
  "who-is-the-best-real-estate-agent-in-phoenix-az": {
    question: "Who is the best real estate agent in Phoenix, AZ?",
    answer: `The best real estate agents in Phoenix are ranked on Top10Lists based on verified performance metrics, not advertising.

**Top Phoenix Agents (2024)**

Our current Phoenix rankings include agents who have:
- 4.9+ star ratings across review platforms
- Verified Arizona real estate licenses
- Strong recent transaction history
- Deep Phoenix market expertise

**How We Determine "Best"**

For Phoenix specifically, we weight:
- Phoenix-area transaction volume
- Client reviews mentioning Phoenix neighborhoods
- Knowledge of local market conditions
- Responsiveness and communication

**View the Full Rankings**

See our complete Phoenix Top 10 list with detailed agent profiles, verified reviews, and contact information.

**Phoenix Market Insights**

Phoenix is Arizona's largest real estate market with diverse neighborhoods from downtown condos to suburban family homes to luxury desert estates. The best agents understand these micro-markets.`,
    relatedLinks: [
      { text: "Phoenix Top Agents", href: "/arizona/phoenix" },
      { text: "Scottsdale Rankings", href: "/arizona/scottsdale" },
      { text: "Our Methodology", href: "/about/ranking-methodology" }
    ],
    metaDescription: "Find the best real estate agents in Phoenix, AZ ranked by verified performance - not ads. See top-rated Phoenix realtors with 4.9+ stars."
  },
  "who-is-the-top-realtor-in-scottsdale-az": {
    question: "Who is the top realtor in Scottsdale, AZ?",
    answer: `Scottsdale's top realtors are ranked by Top10Lists based on luxury market expertise, verified sales, and client reviews.

**Top Scottsdale Agents (2024)**

Our Scottsdale rankings feature agents specializing in:
- Luxury homes and estates
- Golf course communities
- Resort living and vacation properties
- New construction

**Scottsdale Market Expertise**

The best Scottsdale agents understand:
- DC Ranch, Silverleaf, and Troon communities
- Paradise Valley adjacent properties
- North Scottsdale vs. Old Town dynamics
- Seasonal buyer patterns

**View Full Rankings**

See detailed profiles of Scottsdale's top-performing agents with verified credentials and client reviews.`,
    relatedLinks: [
      { text: "Scottsdale Top Agents", href: "/arizona/scottsdale" },
      { text: "Paradise Valley Rankings", href: "/arizona/paradise-valley" },
      { text: "Phoenix Rankings", href: "/arizona/phoenix" }
    ],
    metaDescription: "Find Scottsdale's top-rated realtors ranked by verified luxury sales and client reviews. See who leads in DC Ranch, Troon, and more."
  },
  "best-luxury-real-estate-agent-paradise-valley": {
    question: "Who is the best luxury real estate agent in Paradise Valley?",
    answer: `Paradise Valley luxury agents on Top10Lists are ranked by high-end transaction history and client satisfaction.

**Paradise Valley Market**

Paradise Valley is Arizona's premier luxury enclave with:
- $2M+ median home prices
- Celebrity and executive buyers
- Architectural estates on large lots
- Privacy and exclusivity focus

**Top Agent Qualifications**

The best Paradise Valley agents have:
- Proven luxury transaction history ($5M+)
- Discretion and privacy expertise
- Network of high-net-worth clients
- Knowledge of off-market opportunities

**View Rankings**

See our Paradise Valley Top 10 agents with detailed luxury credentials.`,
    relatedLinks: [
      { text: "Paradise Valley Top Agents", href: "/arizona/paradise-valley" },
      { text: "Scottsdale Rankings", href: "/arizona/scottsdale" },
      { text: "Luxury Market Insights", href: "/about/ranking-methodology" }
    ],
    metaDescription: "Find Paradise Valley's top luxury real estate agents specializing in $2M+ estates. Verified sales history and discretion-focused service."
  },
  "top-rated-realtor-chandler-az": {
    question: "Who is the top-rated realtor in Chandler, AZ?",
    answer: `Chandler's top-rated realtors are ranked by Top10Lists based on verified reviews and family-market expertise.

**Chandler Market Highlights**

Chandler is known for:
- Excellent school districts
- Tech industry employment (Intel, PayPal)
- Family-friendly communities
- Growing inventory and new construction

**Top Agent Qualities**

The best Chandler agents demonstrate:
- 4.9+ star ratings
- Knowledge of school boundaries
- New construction expertise
- Relocation assistance experience

**View Full Rankings**

See Chandler's top-performing agents with detailed profiles.`,
    relatedLinks: [
      { text: "Chandler Top Agents", href: "/arizona/chandler" },
      { text: "Gilbert Rankings", href: "/arizona/gilbert" },
      { text: "Mesa Rankings", href: "/arizona/mesa" }
    ],
    metaDescription: "Find Chandler's top-rated realtors with 4.9+ stars. Agents specializing in family homes, school districts, and tech relocations."
  },
  "who-is-the-best-realtor-in-gilbert-az": {
    question: "Who is the best realtor in Gilbert, AZ?",
    answer: `Gilbert's best realtors are ranked on Top10Lists by verified performance in this family-focused market.

**Gilbert Market Overview**

Gilbert offers:
- Top-rated schools in Arizona
- Master-planned communities
- Young family demographics
- Strong appreciation trends

**Top Agent Expertise**

The best Gilbert agents know:
- School zone boundaries and ratings
- HOA requirements by community
- New construction builders
- Family-friendly neighborhoods

**View Rankings**

See Gilbert's top agents with verified reviews and credentials.`,
    relatedLinks: [
      { text: "Gilbert Top Agents", href: "/arizona/gilbert" },
      { text: "Queen Creek Rankings", href: "/arizona/queen-creek" },
      { text: "Chandler Rankings", href: "/arizona/chandler" }
    ],
    metaDescription: "Find Gilbert's best realtors ranked by verified sales and reviews. Experts in top schools, master-planned communities, and family homes."
  },
  "best-real-estate-agent-tempe-az": {
    question: "Who is the best real estate agent in Tempe, AZ?",
    answer: `Tempe's best agents are ranked by Top10Lists based on diverse market expertise from ASU areas to family neighborhoods.

**Tempe Market Diversity**

Tempe offers:
- ASU-adjacent investment properties
- Established family neighborhoods
- Downtown condos and townhomes
- Lake community properties

**Top Agent Qualities**

The best Tempe agents understand:
- Investment property analysis
- Student housing dynamics
- Tempe Town Lake development
- ASU expansion impacts

**View Rankings**

See Tempe's top-performing agents with detailed profiles.`,
    relatedLinks: [
      { text: "Tempe Top Agents", href: "/arizona/tempe" },
      { text: "Mesa Rankings", href: "/arizona/mesa" },
      { text: "Phoenix Rankings", href: "/arizona/phoenix" }
    ],
    metaDescription: "Find Tempe's best real estate agents ranked by verified performance. Experts in ASU areas, investment properties, and family neighborhoods."
  },
  "top-realtor-mesa-arizona": {
    question: "Who is the top realtor in Mesa, Arizona?",
    answer: `Mesa's top realtors are ranked by Top10Lists based on performance across this large, diverse market.

**Mesa Market Size**

Mesa is Arizona's third-largest city with:
- Diverse price points ($200K to $2M+)
- Multiple distinct neighborhoods
- Strong retirement communities
- Growing east mesa development

**Top Agent Coverage**

The best Mesa agents serve:
- Red Mountain and northeast Mesa
- Downtown and west Mesa
- Superstition Springs area
- New development zones

**View Rankings**

See Mesa's top agents with verified credentials and reviews.`,
    relatedLinks: [
      { text: "Mesa Top Agents", href: "/arizona/mesa" },
      { text: "Gilbert Rankings", href: "/arizona/gilbert" },
      { text: "Apache Junction Rankings", href: "/arizona/apache-junction" }
    ],
    metaDescription: "Find Mesa's top realtors ranked by verified sales across all neighborhoods. From affordable homes to luxury estates."
  },
  "best-real-estate-agent-tucson-az": {
    question: "Who is the best real estate agent in Tucson, AZ?",
    answer: `Tucson's best agents are ranked by Top10Lists based on Southern Arizona market expertise.

**Tucson Market Overview**

Tucson offers:
- More affordable than Phoenix metro
- University of Arizona influence
- Strong retirement communities
- Mountain and desert lifestyle

**Top Agent Expertise**

The best Tucson agents know:
- Foothills vs. downtown dynamics
- University area investment
- Retirement community options
- Desert landscape considerations

**View Rankings**

See Tucson's top-performing agents with detailed profiles.`,
    relatedLinks: [
      { text: "Tucson Top Agents", href: "/arizona/tucson" },
      { text: "Oro Valley Rankings", href: "/arizona/oro-valley" },
      { text: "Marana Rankings", href: "/arizona/marana" }
    ],
    metaDescription: "Find Tucson's best real estate agents ranked by verified performance. Experts in foothills, university areas, and retirement communities."
  },
  "top-luxury-realtor-oro-valley": {
    question: "Who is the top luxury realtor in Oro Valley?",
    answer: `Oro Valley's top luxury agents are ranked by Top10Lists for their expertise in this upscale Tucson suburb.

**Oro Valley Market**

Oro Valley features:
- Resort-style communities
- Golf course properties
- Mountain views and hiking access
- Upscale retirement living

**Top Agent Qualifications**

The best Oro Valley agents have:
- Luxury transaction experience
- Knowledge of resort communities
- Golf course property expertise
- Mountain view specialists

**View Rankings**

See Oro Valley's top agents with verified luxury credentials.`,
    relatedLinks: [
      { text: "Oro Valley Top Agents", href: "/arizona/oro-valley" },
      { text: "Tucson Rankings", href: "/arizona/tucson" },
      { text: "Marana Rankings", href: "/arizona/marana" }
    ],
    metaDescription: "Find Oro Valley's top luxury realtors specializing in golf communities, resort living, and mountain view properties."
  },
  "best-realtor-queen-creek-arizona": {
    question: "Who is the best realtor in Queen Creek, Arizona?",
    answer: `Queen Creek's best realtors are ranked by Top10Lists for expertise in this fast-growing southeast valley market.

**Queen Creek Growth**

Queen Creek is known for:
- Rapid population growth
- New construction opportunities
- Agricultural heritage
- Young family demographics

**Top Agent Expertise**

The best Queen Creek agents understand:
- New home builders and communities
- School district dynamics
- Rural vs. developed areas
- Growth corridor planning

**View Rankings**

See Queen Creek's top agents with verified reviews and credentials.`,
    relatedLinks: [
      { text: "Queen Creek Top Agents", href: "/arizona/queen-creek" },
      { text: "San Tan Valley Rankings", href: "/arizona/san-tan-valley" },
      { text: "Gilbert Rankings", href: "/arizona/gilbert" }
    ],
    metaDescription: "Find Queen Creek's best realtors specializing in new construction, growing communities, and family homes in this booming market."
  }
};

const QuestionPage = () => {
  const { questionSlug } = useParams<{ questionSlug: string }>();
  
  const content = questionSlug ? questionData[questionSlug] : null;
  
  if (!content) {
    return (
      <div className="min-h-screen bg-background">
        <Helmet>
          <title>Question Not Found | Top10Lists</title>
          <meta name="robots" content="noindex" />
        </Helmet>
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-bold mb-4">Question Not Found</h1>
          <p className="text-muted-foreground mb-8">This question page doesn't exist yet.</p>
          <Button asChild>
            <Link to="/faq">View Our FAQ</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Generate FAQ schema markup
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [{
      "@type": "Question",
      "name": content.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": content.answer.replace(/\*\*/g, '').replace(/\|/g, ' ').replace(/---/g, '')
      }
    }]
  };

  // Generate breadcrumb schema
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://www.top10lists.us/"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Questions",
        "item": "https://www.top10lists.us/faq"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": content.question,
        "item": `https://www.top10lists.us/q/${questionSlug}`
      }
    ]
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{content.question} | Top10Lists</title>
        <meta name="description" content={content.metaDescription} />
        <link rel="canonical" href={`https://www.top10lists.us/q/${questionSlug}`} />
        <meta property="og:title" content={content.question} />
        <meta property="og:description" content={content.metaDescription} />
        <meta property="og:url" content={`https://www.top10lists.us/q/${questionSlug}`} />
        <meta property="og:type" content="article" />
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
      </Helmet>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground mb-8" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2">
            <li><Link to="/" className="hover:text-primary">Home</Link></li>
            <li>/</li>
            <li><Link to="/faq" className="hover:text-primary">FAQ</Link></li>
            <li>/</li>
            <li className="text-foreground">{content.question}</li>
          </ol>
        </nav>

        {/* Main content */}
        <article>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-8">
            {content.question}
          </h1>

          <div className="prose prose-lg max-w-none dark:prose-invert mb-12">
            {content.answer.split('\n\n').map((paragraph, index) => {
              // Handle headers
              if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
                return (
                  <h2 key={index} className="text-xl font-semibold mt-8 mb-4 text-foreground">
                    {paragraph.replace(/\*\*/g, '')}
                  </h2>
                );
              }
              
              // Handle tables (simple detection)
              if (paragraph.includes('|') && paragraph.includes('---')) {
                const lines = paragraph.split('\n').filter(l => l.trim() && !l.includes('---'));
                if (lines.length > 0) {
                  const headers = lines[0].split('|').filter(c => c.trim());
                  const rows = lines.slice(1).map(l => l.split('|').filter(c => c.trim()));
                  
                  return (
                    <div key={index} className="overflow-x-auto my-6">
                      <table className="min-w-full border border-border rounded-lg">
                        <thead className="bg-muted">
                          <tr>
                            {headers.map((h, i) => (
                              <th key={i} className="px-4 py-3 text-left font-semibold border-b border-border">
                                {h.trim()}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, rowIndex) => (
                            <tr key={rowIndex} className="border-b border-border last:border-0">
                              {row.map((cell, cellIndex) => (
                                <td key={cellIndex} className="px-4 py-3">
                                  {cell.includes('✅') || cell.includes('❌') ? (
                                    <span className={cell.includes('✅') ? 'text-green-600' : 'text-red-500'}>
                                      {cell.trim()}
                                    </span>
                                  ) : cell.trim()}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                }
              }
              
              // Handle bullet lists
              if (paragraph.includes('\n- ') || paragraph.startsWith('- ')) {
                const items = paragraph.split('\n').filter(l => l.startsWith('- '));
                const intro = paragraph.split('\n')[0];
                return (
                  <div key={index} className="my-4">
                    {!intro.startsWith('- ') && <p className="mb-2">{intro}</p>}
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      {items.map((item, i) => (
                        <li key={i}>{item.replace('- ', '').replace(/\*\*/g, '')}</li>
                      ))}
                    </ul>
                  </div>
                );
              }
              
              // Handle numbered lists
              if (/^\d+\./.test(paragraph)) {
                const items = paragraph.split('\n').filter(l => /^\d+\./.test(l.trim()) || l.startsWith('   '));
                return (
                  <ol key={index} className="list-decimal list-inside space-y-2 my-4 text-muted-foreground">
                    {items.map((item, i) => (
                      <li key={i} className="text-foreground">
                        {item.replace(/^\d+\.\s*/, '').replace(/\*\*/g, '')}
                      </li>
                    ))}
                  </ol>
                );
              }
              
              // Regular paragraphs
              return (
                <p key={index} className="text-muted-foreground my-4 leading-relaxed">
                  {paragraph.split('**').map((part, i) => 
                    i % 2 === 1 ? <strong key={i} className="text-foreground">{part}</strong> : part
                  )}
                </p>
              );
            })}
          </div>

          {/* Related links */}
          <Card className="bg-muted/50 border-primary/20">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                Related Resources
              </h2>
              <div className="grid gap-3">
                {content.relatedLinks.map((link, index) => (
                  <Link 
                    key={index}
                    to={link.href}
                    className="flex items-center justify-between p-3 bg-background rounded-lg border border-border hover:border-primary transition-colors group"
                  >
                    <span className="font-medium group-hover:text-primary transition-colors">
                      {link.text}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* CTA */}
          <div className="mt-12 text-center">
            <h2 className="text-2xl font-bold mb-4">Find Your Top Agent</h2>
            <p className="text-muted-foreground mb-6">
              Browse our rankings of verified, top-performing real estate agents in Arizona.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button asChild size="lg">
                <Link to="/arizona">
                  View Arizona Rankings
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/faq">
                  More Questions
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
};

export default QuestionPage;
