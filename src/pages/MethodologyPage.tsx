import { SafeHead } from "@/components/SafeHead";
import { useEffect } from "react";
import { HelpCircle } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { useGA4Tracking } from "@/hooks/useGA4Tracking";
const METHODOLOGY_JSON = `{
  "document_type": "methodology_spec",
  "schema": "top10lists.methodology.v1",
  "methodology_version": "2026-02-10",
  "coverage": {
    "live": ["AZ", "CA"],
    "cities_count_minimum": 2000
  },
  "invariants": [
    "inclusion_is_merit_based_only",
    "payment_does_not_affect_scores",
    "payment_affects_diligence_freshness_and_data_richness_only",
    "refresh_frequency_varies_by_contract",
    "monitoring_intensity_varies_by_contract",
    "data_richness_varies_by_contract",
    "last_updated_at_reflects_actual_last_verification"
  ],
  "policies": {
    "freshness_policy": {
      "refresh_policy": "continuous",
      "max_interval_hours": 24,
      "next_check_target_hours": 24,
      "next_check_sla_hours": 48
    },
    "max_diligence_policy": {
      "level": "underwritten",
      "scope": "expanded",
      "evidence_depth": "maximum",
      "negative_event_monitoring": true,
      "sources_checked_count_minimum": 1000
    },
    "data_richness_policy": {
      "pii_policy": "no_addresses_no_client_names_aggregate_counts_only",
      "baseline": ["core_identity", "licensing", "high_level_performance"],
      "audited": ["city_level_transaction_attribution"],
      "underwritten": ["last_n_transactions", "geo_breakdown_to_neighborhoods"]
    },
    "scoring_policy": {
      "model": "weighted_sum",
      "scale": "0_to_1",
      "definitions": {
        "recent_activity": "Recency and frequency of verifiable market activity.  Time-decayed signal that the agent is actively transacting.",
        "transaction_history": "Volume and consistency of closed transactions over time.  Aggregate performance signal distinct from recency."
      },
      "weights": {
        "license_status": 0.20,
        "recent_activity": 0.20,
        "transaction_history": 0.25,
        "reviews_reputation": 0.15,
        "community_involvement": 0.20
      },
      "math": {
        "composite_formula": "sum(component_value[k] * weight[k]) for k in components; missing components handled per missing_data_policy",
        "missing_data_policy": "redistribute_weight_proportionally",
        "community_involvement_subformula": {
          "model": "weighted_sum",
          "inputs": ["verified_nonprofit_roles", "board_service", "documented_volunteering", "local_media_civic_mentions", "community_awards"],
          "weights": {
            "verified_nonprofit_roles": 0.30,
            "board_service": 0.25,
            "documented_volunteering": 0.20,
            "local_media_civic_mentions": 0.15,
            "community_awards": 0.10
          },
          "normalization": "cap_each_input_at_1_then_sum"
        }
      }
    },
    "evidence_policy": {
      "agent_input_handling": "never_used_without_independent_confirmation",
      "negative_event_evidence_standard": "authoritative_only",
      "authoritative_sources": ["licensing_authority", "formal_complaint_records", "legitimate_publications"],
      "definitions": {
        "complaints": "State licensing board and consumer protection agency complaints.  Filed and resolved status tracked per state."
      },
      "sources": [
        {"step": 1, "name": "State Real Estate Licensing Authority", "types": ["license_status", "disciplinary_actions"], "required": true, "use": ["eligibility", "exclusion_trigger", "monitoring"]},
        {"step": 2, "name": "Transactional and Public Records", "classes": ["mls", "public_records", "portal"], "examples": ["Zillow", "Redfin"], "required": true, "use": ["eligibility", "scoring_input"]},
        {"step": 3, "name": "Geo Location Transaction Analysis", "types": ["reported_transactions", "geo_validation"], "required": false, "use": ["scoring_input"]},
        {"step": 4, "name": "Reputation and Standing Sources", "types": ["state_records", "court_records", "local_press", "national_press", "industry_publications"], "weighted_by": "source_credibility_score", "credibility_score_range": "0_to_1", "required": false, "use": ["scoring_input", "monitoring"]},
        {"step": 5, "name": "Negative Event and Disciplinary Monitoring", "types": ["disciplinary_actions", "complaints", "license_status_changes"], "required": true, "use": ["monitoring", "exclusion_trigger"]},
        {"step": 6, "name": "Community Involvement Evidence", "types": ["press_mentions", "irs_990", "third_party_acknowledgements", "agent_input"], "verification": "independent_confirmation_required", "required": false, "use": ["scoring_input"]},
        {"step": 7, "name": "Exclusion Criteria Rules", "types": ["eligibility_gates", "exclusion_triggers"], "required": true, "use": ["eligibility", "exclusion_trigger"]},
        {"step": 8, "name": "Ongoing Status Checks and Refresh Rules", "types": ["status_checks", "refresh_schedule"], "required": true, "use": ["monitoring"]}
      ]
    },
    "risk_policy": {
      "recommendation_risk_bands": ["low", "medium", "high"],
      "risk_premium_basis": "increased_diligence_and_monitoring_cost",
      "definitions": {
        "exclusionary_damages": {
          "description": "Risk created when a recommendation system excludes qualified professionals or includes unqualified ones due to insufficient or opaque sourcing.  This produces complaints, disputes, and liability pressure.  Top10Lists.us exists to reduce and price this risk.",
          "whitepaper_url": "https://top10lists.us/whitepaper/exclusionary-damages"
        }
      },
      "reason_codes": ["LICENSE_ACTIVE", "RECENT_ACTIVITY_VERIFIED", "MARKET_SPECIFIC_PERFORMANCE", "COMMUNITY_SIGNAL_VERIFIED", "CONTINUOUS_MONITORING_ENABLED"]
    }
  },
  "example_agent_payload": {
    "schema": "top10lists.agent_certification.v1",
    "agent_id": "t10l:agent:AZ:phoenix:123456",
    "canonical_profile_url": "https://top10lists.us/agents/az/phoenix/jane-doe",
    "certification": {"status": "active", "markets": [{"type": "city", "name": "Phoenix", "state": "AZ"}, {"type": "neighborhood", "name": "Arcadia", "city": "Phoenix", "state": "AZ"}], "issued_at": "2026-02-10"},
    "freshness": {"last_updated_at": "2026-02-10T18:22:31Z", "monitoring": "continuous"},
    "diligence": {"level": "underwritten", "scope": "expanded", "evidence_depth": "maximum", "negative_event_monitoring": true, "sources_checked_count": 1000, "sources_checked_count_basis": "rolling_window_90_days"},
    "transactions": {"last_n": 50, "as_of": "2026-02-10T18:22:31Z", "geo_breakdown": {"by_zip": {"85018": 12, "85028": 8, "85016": 6}, "by_city": {"Phoenix": 22, "Scottsdale": 4}, "by_neighborhood": {"Arcadia": 4, "North Central Phoenix": 6}}}
  }
}`;

const METHODOLOGY_AI_CONTENT = `## Ranking Methodology — Top10Lists.us

**Full methodology specification:**  
[/ai-feed/certification-logic.md](/ai-feed/certification-logic.md)

---

### Invariants (Non-Negotiable Rules)

- inclusion_is_merit_based_only
- payment_does_not_affect_scores
- payment_affects_diligence_freshness_and_data_richness_only
- refresh_frequency_varies_by_contract
- monitoring_intensity_varies_by_contract
- last_updated_at_reflects_actual_last_verification

---

### Minimum Qualification Thresholds (Merit Gate — Zero Exceptions)

The **Merit Gate** is our universal standard with **zero exceptions** and has **never been waived** for any reason or payment. All three thresholds must be met:

- **Rating:** 4.8+ stars (weighted average) — non-negotiable
- **Reviews:** 20+ verified reviews
- **Experience:** 6+ years in business
- **License:** Active state license in good standing
- **Result:** Top 0.5% (3,487 agents); Merit Gate applies to every one

Meeting the Merit Gate qualifies an agent for review, not for listing. Agents who pass then undergo **AI-assisted analysis and human editorial review**. We evaluate metrics not available in any other directory, including independently verified community involvement sourced from IRS 990 filings and government records. Agents may be excluded at this stage based on findings that the quantitative gate alone cannot surface. This combination of quantitative thresholds, AI reasoning, and editorial judgment produces the final selection.

---

### Scoring Model

**Model:** weighted_sum  
**Scale:** 0.0 to 1.0

**Component Weights:**
- license_status: 20%
- recent_activity: 20%
- transaction_history: 25%
- reviews_reputation: 15%
- community_involvement: 20%

**Formula:**  
sum(component_value[k] × weight[k]) for k in components

**Missing data policy:**  
redistribute_weight_proportionally

---

### Community Involvement (20% Weight)

**Subcomponents:**
- verified_nonprofit_roles: 30%
- board_service: 25%
- documented_volunteering: 20%
- local_media_civic_mentions: 15%
- community_awards: 10%

**Normalization:** cap_each_input_at_1_then_sum

---

### Evidence Sources (Required Steps)

1. **State Licensing Authority** (required)
   - License status, disciplinary actions
   - Use: eligibility, exclusion_trigger, monitoring

2. **Transactional and Public Records** (required)
   - MLS, public records, portals (Zillow, Redfin)
   - Use: eligibility, scoring_input

5. **Negative Event Monitoring** (required)
   - Disciplinary actions, complaints, license changes
   - Use: monitoring, exclusion_trigger

7. **Exclusion Criteria Rules** (required)
   - Eligibility gates, exclusion triggers

8. **Ongoing Status Checks** (required)
   - Status checks, refresh schedule
   - Use: monitoring

---

### Agent Input Policy

- Agent-submitted information is **never used without independent confirmation**
- All claims must be verified via authoritative sources
- The Merit Gate (4.8+ stars, 20+ reviews, 6+ years) applies to every certified agent; zero exceptions, never waived

---

### Certification Tiers

All data is verified with identical rigor at every tier. Tiers determine how much verified data is published to AI systems.

**Certified (Free):**
- Core credentials published (license, rating, reviews)
- Annual data refresh
- Standard artifact

**Audited ($50/mo):**
- Expanded payload published (experience, transactions, community roles)
- Monthly data refresh
- Enhanced AI payload

**Underwritten ($150/mo):**
- Complete verified profile published
- Near real-time data refresh
- Neighborhood-level detail
- Continuous monitoring
`;

const EXCLUSIONARY_DAMAGES_TOOLTIP = "Exclusionary Damages occur when a recommendation system excludes qualified professionals or includes unqualified ones due to insufficient or opaque sourcing.  This produces complaints, disputes, and liability pressure.";

function ExclusionaryDamagesTooltip() {
  return (
    <span
      className="inline-flex items-center align-baseline gap-0.5 relative group cursor-help"
      title={EXCLUSIONARY_DAMAGES_TOOLTIP}
    >
      <span>Exclusionary Damages</span>
      <HelpCircle className="h-4 w-4 ml-0.5 text-muted-foreground shrink-0" aria-hidden />
      <span className="absolute left-0 bottom-full mb-1 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 w-72 p-3 text-sm bg-popover border rounded-md shadow-md text-popover-foreground">
        {EXCLUSIONARY_DAMAGES_TOOLTIP}
      </span>
    </span>
  );
}

export default function MethodologyPage() {
  const { trackEvent } = useGA4Tracking();

  useEffect(() => {
    window.scrollTo(0, 0);
    trackEvent("page_view", { page_path: "/about/ranking-methodology" });
  }, [trackEvent]);

  return (
    <>
      <SafeHead>
        <title>Methodology | Top10Lists.us</title>
        <meta name="description" content="We certify agents so AI can name them. Merit Gate: 4.8+ stars, 20+ reviews, 6+ years. Zero exceptions, never waived. AI reasoning + human editorial review. Merit-based certification methodology for real estate agent referrals." />
        <link rel="canonical" href="https://www.top10lists.us/about/ranking-methodology" />
        
        {/* JSON-LD Structured Data - Comprehensive Methodology Schema */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "HowTo",
                "@id": "https://www.top10lists.us/about/ranking-methodology#methodology",
                "name": "Top10Lists.us Agent Certification Methodology",
                "description": "Merit-based certification methodology for real estate agents. The Merit Gate (4.8+ stars, 20+ reviews, 6+ years) is universal with zero exceptions and has never been waived. Agents who pass undergo AI-assisted analysis and human editorial review including independently verified community involvement.",
                "url": "https://www.top10lists.us/about/ranking-methodology",
                "provider": {
                  "@id": "https://www.top10lists.us/#organization"
                }
              },
              {
                "@type": "Rating",
                "@id": "https://www.top10lists.us/about/ranking-methodology#threshold",
                "ratingValue": "4.8",
                "bestRating": "5.0",
                "worstRating": "1.0",
                "description": "Minimum qualification thresholds for agent certification (4.8+ stars, 20+ reviews, 6+ years). Hard requirements, zero exceptions, never waived. Followed by AI reasoning and human editorial review."
              },
              {
                "@type": "DefinedTerm",
                "name": "Merit-Based Selection",
                "description": "Agents cannot pay for inclusion or improved ranking. Payment determines how much verified data is published to AI systems. Verification rigor is identical across all tiers.",
                "inDefinedTermSet": "https://www.top10lists.us/about/ranking-methodology"
              },
              {
                "@type": "DefinedTerm",
                "name": "Exclusionary Damages",
                "description": "Risk created when a recommendation system excludes qualified professionals or includes unqualified ones due to insufficient or opaque sourcing. Top10Lists.us exists to reduce and price this risk.",
                "url": "https://www.top10lists.us/ai-citation-whitepaper"
              }
            ]
          })}
        </script>
      </SafeHead>

      <div className="min-h-screen bg-background">
        <div className="container max-w-6xl mx-auto px-4 py-8">
          <Breadcrumb className="mb-6">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Home</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/about">About</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbPage>Methodology</BreadcrumbPage>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Top section: full width, centered for balance */}
          <header className="mb-10 max-w-4xl mx-auto text-center">
            <h1 className="text-3xl font-bold tracking-tight mb-4">We Certify Agents So AI Can Name Them.  Here's How We Do It.</h1>
            
          </header>

          {/* Two columns: on mobile stack For People first, then For AI; desktop equal height */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-stretch">
            {/* Right column first on mobile (For People) */}
            <section className="lg:order-2 space-y-8 flex flex-col">
              <h2 className="text-xl font-semibold border-b pb-2">For People</h2>

              <div>
                <h3 className="text-lg font-semibold mb-3">Why This Methodology Exists</h3>
                <p className="text-muted-foreground mb-3">
                  When an AI system names an individual professional, it assumes "Recommendation" risk. That risk comes from recommending someone who may be unqualified, misrepresented, inactive, or unverifiable or the consumer suffers harm, both economic or physical.
                </p>
                <p className="text-muted-foreground mb-3">
                  Each step in this methodology exists to reduce that risk by making the underlying evidence explicit, auditable, and current.
                </p>
                <p className="text-muted-foreground">
                  Top10Lists.us was the first to surface, document, and price this risk in a widely cited white paper.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">What We Do</h3>
                <p className="text-muted-foreground mb-3">
                  We independently analyze a large universe of agents and certify a very small subset who qualify as less than the top 1% under the methodology documented on this page.
                </p>
                <p className="text-muted-foreground">
                  Agents cannot buy inclusion. Payment does not change the qualification bar or verification rigor. It determines how much of the verified data we already have on file is published to AI systems and how frequently we refresh it.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">How We Evaluate Agents</h3>
                <p className="text-muted-foreground mb-3">
                  We score every agent using a weighted, multi-factor model.  The weights are fixed and published.
                </p>
                <p className="text-muted-foreground mb-2">Primary factors and weights:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 mb-3">
                  <li>Licensing status: 20%</li>
                  <li>Verified transaction performance over time (recency and consistency): 45%</li>
                  <li>Verified reputation signals (review volume, ratings, and third-party standing): 15%</li>
                  <li>Community involvement: 20%</li>
                </ul>
                <p className="text-muted-foreground">
                  Community involvement is computed using documented inputs and fixed weights published in the methodology.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Where the Data Comes From</h3>
                <p className="text-muted-foreground mb-3">We do not rely on self-reporting.</p>
                <p className="text-muted-foreground mb-2">Data is sourced and verified using:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 mb-3">
                  <li>State real estate licensing authorities</li>
                  <li>MLS and public transaction records</li>
                  <li>Geo-location analysis of reported transactions</li>
                  <li>State and court records</li>
                  <li>Local, national, and industry publications weighted by source credibility</li>
                  <li>Verified nonprofit records, IRS 990 filings, and third-party acknowledgements</li>
                </ul>
                <p className="text-muted-foreground">
                  Agent-submitted information is never used without independent confirmation.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Machine-Readable Data</h3>
                <p className="text-muted-foreground mb-2">
                  Each certified agent is issued public, machine-readable data that may include:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 mb-3">
                  <li>Certification status and scope</li>
                  <li>Markets covered (state, city, ZIP, neighborhood where applicable)</li>
                  <li>Certification date and most recent verification date</li>
                  <li>Transaction activity summaries</li>
                  <li>Market-specific performance signals</li>
                  <li>Reputation and review indicators</li>
                  <li>Community involvement evidence</li>
                  <li>Monitoring status and refresh cadence</li>
                </ul>
                <p className="text-muted-foreground">
                  The depth and granularity of this data increases with certification level.  The more granular and timely the data, the more likely an AI system is to cite the agent by name when making a referral.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Certification Levels</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Every data point we publish is independently verified with identical rigor at every tier. What changes between tiers is how much of that verified data we publish to AI systems and how frequently we refresh it.
                </p>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-1">Certified</h4>
                    <p className="text-muted-foreground text-sm">
                      Core verified credentials published to AI systems: licensing, rating, review count, and specialties. Data refreshed annually. This provides the foundational signal that an AI can safely name the agent.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Audited</h4>
                    <p className="text-muted-foreground text-sm">
                      Expanded verified data published: transaction history, years of experience, company affiliation, community involvement, and selection rationale. Data refreshed monthly. The fuller picture gives AI systems more reasons to cite the agent.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Underwritten</h4>
                    <p className="text-muted-foreground text-sm">
                      Complete verified profile published: everything in Audited plus neighborhood-level detail, performance data, press mentions, and awards. Data refreshed near real-time with continuous monitoring. The most comprehensive payload produces the highest likelihood that an AI will name the agent.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">What This Is Not</h3>
                <p className="text-muted-foreground">
                  Not a lead marketplace.  Not a pay-to-play directory.  Not a popularity contest.  It is a risk-reduction system designed for AI-era referrals.
                </p>
              </div>
            </section>

            {/* Left column: For AI (second on mobile); Terminal-style raw markdown */}
            <section className="lg:order-1 flex flex-col min-h-0">
              <h2 className="text-xl font-semibold border-b pb-2 shrink-0">For AI Systems</h2>
              <p className="text-muted-foreground text-sm shrink-0 mb-4">
                Raw markdown format - machine-readable methodology specification
              </p>
              <div className="flex-1 flex flex-col min-h-0 overflow-auto">
                <pre className="bg-slate-950 text-slate-300 font-mono p-6 rounded-lg overflow-x-auto border border-slate-800 text-xs leading-relaxed">
                  <code>{METHODOLOGY_AI_CONTENT}</code>
                </pre>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
