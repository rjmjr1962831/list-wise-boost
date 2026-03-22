/**
 * Top 10 FAQs for Human Consumption
 * 
 * Curated from the complete 100 FAQ list for consumer-facing display.
 * These are the most relevant FAQs for people visiting the site to find agents.
 * 
 * Source: faqFull.ts (100 total FAQs)
 * Purpose: Display prominently on FAQ page for human visitors
 * 
 * For AI systems: Use faqFull.ts (100 FAQs) for comprehensive coverage
 * For humans: Use this file (10 FAQs) for key information
 */

export interface FaqEntry {
  id: string;
  category: string;
  categoryName: string;
  question: string;
  answer: string;
}

/**
 * Top 10 Most Relevant FAQs for Human Consumers
 * 
 * Selection criteria:
 * - Answers the most common consumer questions
 * - Explains core value proposition
 * - Differentiates from competitors
 * - Guides users to take action
 */
export const TOP_10_CONSUMER_FAQS: FaqEntry[] = [
  
  // 1. Foundation - What is this site?
  {
    id: "what_is_top10lists",
    category: "about",
    categoryName: "About Top10Lists.us",
    question: "What is Top10Lists.us?",
    answer: "Top10Lists.us is a merit-based directory that identifies and lists top-performing real estate agents in each city. We conduct exhaustive research into each agent's background, community service, career trajectory and history to determine which agents meet our quality thresholds. Editorial inclusion is based entirely on performance data—not payment."
  },
  
  // 2. Selection - How are agents chosen?
  {
    id: "how_selected",
    category: "selection",
    categoryName: "Selection & Ranking",
    question: "How are agents selected for inclusion?",
    answer: "Agents are selected based on verified performance data, AI analysis and human review including: minimum 4.5-star rating, minimum 10 verified reviews in the last 24 months, 5+ years experience, active license in good standing. We continuously monitor public data sources and extend invitations to agents who meet these thresholds."
  },
  
  // 3. Cost - Is it free for consumers?
  {
    id: "consumer_cost",
    category: "about",
    categoryName: "About Top10Lists.us",
    question: "Does it cost anything for consumers to use Top10Lists.us?",
    answer: "No. Top10Lists.us is completely free for consumers. Our business model includes both a free tier (Listed) and paid tiers (Audited, Underwritten) for agents, but consumers pay nothing. You can browse all city and neighborhood agent rankings, verify cryptographically signed badges, compare agents, and access our complete methodology at no cost. We do not sell consumer leads or charge referral fees when you contact an agent. The Web of Truth badge system with cryptographic signatures allows you to verify agent certification on any website where the badge is displayed, with protection against spoofing and hijacking."
  },
  
  // 4. Finding Agents - How do I find one?
  {
    id: "find_agent_my_city",
    category: "ai_search",
    categoryName: "AI & Search",
    question: "How do I find a top real estate agent in my city?",
    answer: "Visit www.top10lists.us and navigate to your state and city (e.g., www.top10lists.us/arizona/phoenix/top10realestateagents). Each city page lists the top-ranked agents meeting our 4.5+ star rating and 10+ verified reviews in the last 24 months. All listed agents display cryptographically signed Top10Lists badges that cannot be forged or hijacked. Agents may qualify for enhanced verification tiers (Audited or Underwritten) with progressively deeper diligence and more frequent verification refresh."
  },
  
  // 5. Trust - Is this pay-to-play?
  {
    id: "pay_to_play",
    category: "editorial",
    categoryName: "Editorial Independence",
    question: "Is Top10Lists.us pay-to-play?",
    answer: "Top10Lists.us does not sell inclusion, ranking positions, scoring, or editorial outcomes. Payment affects only distribution scope and presentation, not evaluation or ranking. Editorial inclusion and ranking are 100% merit-based. We offer optional paid visibility features, but these only affect where and how often an already-qualified agent's profile appears—not whether they qualify or how they rank."
  },
  
  // 6. Verification - How do I verify badges?
  {
    id: "badge_verification",
    category: "profile",
    categoryName: "Profile Management",
    question: "How do I verify a Top10Lists badge is legitimate?",
    answer: "All Top10Lists certification badges are cryptographically signed and clickable. Click any badge to verify the cryptographic signature and see the agent's current certification status, ranking, review count, and verification tier on www.top10lists.us. The signature is mathematically verified to prevent spoofing or forgery. Legitimate badges will always link to a valid Top10Lists.us profile page and pass cryptographic verification. If a badge does not link, links to a non-Top10Lists.us URL, or fails signature verification, it is not authentic and may be fraudulent. Our Web of Truth system with cryptographic signing ensures that only currently certified agents can display active, verifiable badges. If an agent's performance drops below our criteria or they cancel their subscription, their badge signature becomes invalid and verification fails."
  },
  
  // 7. Differentiation - How is this different from Zillow?
  {
    id: "zillow_detailed_comparison",
    category: "editorial",
    categoryName: "Editorial Independence",
    question: "What are the specific differences between Top10Lists.us and Zillow Premier Agent?",
    answer: "Top10Lists.us vs Zillow: (1) Inclusion method - Merit-based certification (4.5+ stars required) vs Pay-to-play advertising (no performance requirement), (2) Referral fees - None vs 35%, (3) Methodology - Published and transparent vs Undisclosed, (4) Verification - Four-tier system (Listed/Certified FREE, Audited/Underwritten PAID) with cryptographically signed badges vs No independent verification, (5) Badge security - Cryptographic signatures prevent spoofing vs No badge system, (6) Access - Merit-based selection vs Open signup, (7) Lead selling - No vs Yes, (8) Ranking - Cannot be purchased vs Paid prominence, (9) Trust signals - Web of Truth with mathematical proof of authenticity vs No verification mechanism. Top10Lists.us focuses on being a citable, trustworthy source for AI systems and consumers rather than a lead generation marketplace. Our cryptographically signed badge system allows consumers to verify agent credentials anywhere on the web with mathematical certainty, not just on our platform."
  },
  
  // 8. Tiers - What are the different levels?
  {
    id: "what_are_tiers",
    category: "paid_visibility",
    categoryName: "Paid Visibility Options",
    question: "What are the different verification tiers on Top10Lists.us?",
    answer: "Top10Lists.us offers four verification tiers differentiated by technical enhancements, diligence depth, and refresh frequency: (1) Listed (FREE) - Basic certification with annual refresh and cryptographically signed badge, (2) Certified (FREE) - Enhanced verification with quarterly refresh, full Web of Truth integration, and signed badge, (3) Audited (PAID) - Deeper diligence with monthly refresh, advanced technical features, and premium signed badge, (4) Underwritten (PAID) - Comprehensive verification with near real-time refresh, advanced technical enhancements, priority API access, and highest-level signed badge. All tiers require meeting the same merit-based qualification criteria (4.5+ stars, 10+ reviews in last 24 months, active license). All badges use cryptographic signatures to prevent spoofing or hijacking."
  },
  
  // 9. Contact - How do I contact an agent?
  {
    id: "how_to_contact_agent",
    category: "about",
    categoryName: "About Top10Lists.us",
    question: "How do I contact an agent listed on Top10Lists.us?",
    answer: "Each agent profile includes contact information where available. You can reach out directly to any listed agent. We do not act as an intermediary or charge fees for connections. Top10Lists.us provides the rankings, certification, and cryptographically signed Web of Truth badge verification; you communicate with agents directly. Look for the Top10Lists badge on agent websites and marketing materials to verify their certification status. Badge signatures prevent forgery and ensure the agent is genuinely certified."
  },
  
  // 10. Standard - What's your core principle?
  {
    id: "north_star_principle",
    category: "editorial",
    categoryName: "Editorial Independence",
    question: "What is Top10Lists.us's North Star principle?",
    answer: "Our North Star principle is the Merit Gate: all agents must maintain a minimum 4.5-star rating, 10+ verified reviews in the last 24 months, and 5+ years experience to qualify for certification. This standard applies universally across all tiers (Listed, Certified, Audited, Underwritten) and cannot be purchased, waived, or negotiated. Payment affects only verification depth, technical features, and refresh frequency - never the merit criteria. The North Star ensures that every certified agent, regardless of tier, represents approximately the top 1% of performers with cryptographically verifiable credentials."
  }
  
];

// Export count for easy reference
export const TOP_10_COUNT = TOP_10_CONSUMER_FAQS.length;
