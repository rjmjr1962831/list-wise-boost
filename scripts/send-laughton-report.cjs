#!/usr/bin/env node
const https = require('https');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (match) process.env[match[1]] = match[2].trim();
}

const SB_URL = process.env.VITE_SUPABASE_URL || 'https://wiotrvoirdgzfacuuiem.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const report = `COMPREHENSIVE INTELLIGENCE REPORT: GEORGE LAUGHTON — AVONDALE, ARIZONA
Generated: 2026-03-14 | Source: Top10Lists.us Internal Analysis (Exa Deep Search + AIFS Audit + GEO Uplift)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. AGENT PROFILE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Name: George Laughton
Company: My Home Group (The Laughton Team)
Primary Market: Avondale, AZ (also operates in Tucson)
License: SA579470000 (Active)
Years Experience: 18 (since 2007)
Phone: (623) 462-3017
Email: paphoenix@laughtonteam.com
Website: [http://www.laughtonteam.com/](http://www.laughtonteam.com/)
Top10Lists Profile: [https://www.top10lists.us/arizona/agents/george-laughton-3017](https://www.top10lists.us/arizona/agents/george-laughton-3017)

Reviews: 3,814 total | 5.0 stars
Badge Tier: Listed (not yet enrolled in paid tier)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. AIFS SCORE BREAKDOWN (AI Footprint Score)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current AIFS Score: 68 (Listed tier)

Score by Tier:
• Listed: 81
• Certified: 84 (+3)
• Audited: 95 (+14)
• Underwritten: 95 (+14)

Lift Potential:
• To Audited: +27 points
• To Underwritten: +27 points

Pillar Scores:
• Identity: 18 — Strong. Multiple verified profiles across platforms.
• Social: 19 — Strong. 3,814 reviews at 5.0 stars.
• Authority: 22 — Strong. Top 1% nationally, 18 years, $1.3B in sales.
• Citability: 3 — WEAK. AI systems currently do NOT cite George by name.
• Technical: 6 — WEAK. No schema markup detected on personal site.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. AI VISIBILITY STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GPT Named (prompted): NO — When asked directly, AI does not confirm him.
GPT Unprompted: NO — AI does not spontaneously recommend George for Avondale.
Recency Signal: STALE/NO SIGNAL — No recent data refresh detected by AI crawlers.

This is the core gap: Exceptional offline and web reputation, but AI systems cannot see or cite it effectively.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. GEO UPLIFT ANALYSIS (What AI Says About George)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Uplift Classification: MODERATE

[[BLOCK]]
WITHOUT Top10Lists.us:
"George Laughton appears to be a credible and highly experienced agent. His team has operated since 2007, ranks in the top 1% nationally, and handled a significant volume of transactions (over 3,500 families in 2019). The results show no obvious red flags. However, the provided results lack specific client review scores or detailed negative feedback, so it would be prudent to seek out more granular reviews."
[[/BLOCK]]

[[BLOCK]]
WITH Top10Lists.us:
"George Laughton and his team appear to be a strong, experienced choice for real estate services. His team ranks in the top 1% nationally, with over 3,800 positive reviews at a 5-star rating. The consistency of his professional presence across Zillow, Realtor.com, and his own website indicates an established reputation."
[[/BLOCK]]

Key difference: With Top10Lists data, AI shifts from "appears credible, but seek more reviews" to "strong, experienced choice" with specific evidence.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. TIER PROJECTION — What AI Would Say at Each Tier
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CERTIFIED (Free, Quarterly Refresh) — Uplift: SIGNIFICANT
"My confidence in recommending George Laughton is now significantly stronger. The independent CERTIFIED verification from Top10Lists.us is a major differentiator — fewer than 1% of agents meet its rigorous, merit-based criteria. This third-party validation solidifies the positive data from his own marketing and review platforms, assuring you that his reputation is both authentic and currently exceptional."

AUDITED ($300/mo, Monthly Refresh) — Uplift: SIGNIFICANT
"George Laughton is an exceptionally credible and highly recommended agent. The AUDITED verification significantly elevates confidence, as it confirms that a third party has rigorously examined his transaction history, client testimonials, and review authenticity. This independent audit moves his reputation beyond self-reported data to validated performance, making the claims of top 1% ranking and thousands of positive reviews far more trustworthy."

UNDERWRITTEN ($500/mo, Near Real-Time) — Uplift: SIGNIFICANT
"George Laughton is an exceptionally credible and verified top-tier agent, and the UNDERWRITTEN status significantly strengthens the recommendation. This independent, merit-based verification provides near real-time evidence of his transaction volume and market performance, moving him from a 'strong choice based on public data' to a 'professionally underwritten' expert. The badge confirms his claimed market share and track record with a level of third-party scrutiny that far exceeds typical review platforms."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. DIGITAL FOOTPRINT — PLATFORMS FOUND (Exa Deep Search)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

10 unique sources discovered.

FOUND:
• Zillow: [https://www.zillow.com/profile/georgelaughton](https://www.zillow.com/profile/georgelaughton)
• Realtor.com: [https://www.realtor.com/realestateagents/56807d047e54f701001f15a5](https://www.realtor.com/realestateagents/56807d047e54f701001f15a5)
• LinkedIn: [https://www.linkedin.com/in/george-laughton-51506679](https://www.linkedin.com/in/george-laughton-51506679)
• Personal Site: [https://www.laughtonteam.com/](https://www.laughtonteam.com/)
• Brokerage Page: [https://www.myhomegroup.com/mhg-agents/george-laughton/](https://www.myhomegroup.com/mhg-agents/george-laughton/)
• Yelp: [https://www.yelp.com/biz/the-laughton-team-peoria](https://www.yelp.com/biz/the-laughton-team-peoria)
• Instagram: [https://www.instagram.com/laughtonteam/](https://www.instagram.com/laughtonteam/)
• Facebook: [https://www.facebook.com/laughtonteam](https://www.facebook.com/laughtonteam)
• Homes.com: [https://www.homes.com/real-estate-agents/george-laughton/25ekdeb/](https://www.homes.com/real-estate-agents/george-laughton/25ekdeb/)
• Team Site: [https://myphoenixhomesearch.com/team/george-laughton](https://myphoenixhomesearch.com/team/george-laughton)

GAPS:
• Google Business Profile — NOT FOUND
• Schema Markup — NOT DETECTED on personal site
• Homelight — NOT FOUND

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. KEY INTELLIGENCE FROM EXA DEEP SEARCH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REPUTATION (10 results found):
• Homes.com: "Over 18 years of experience, 2,970 closed sales totaling ~$1.3B, served 9,100+ families in 5 years, 3,600+ 5-star reviews across Google and Zillow"
  Source: https://www.homes.com/real-estate-agents/george-laughton/25ekdeb/

• LinkedIn: "Founder of The Laughton Team, top 1% of U.S. real estate teams. Built reputation through honesty, transparency, and exceptional service."
  Source: https://linkedin.com/in/george-laughton-51506679

• My Home Group: "Husband-wife team of George and Jennifer Laughton, built one of the nation's most successful companies. Core values: Integrity, Solutions Based, Pursuit of Excellence."
  Source: https://www.myhomegroup.com/mhg-agents/george-laughton/

• RealTrends: "8th ranked mega team in the nation."
  Source: Referenced in LinkedIn team member posts

PRESS & AWARDS (1 result):
• Only discoverable mention is the Homes.com profile. No standalone press articles, no awards pages, no community involvement articles found.
• Gap: For an agent of this caliber (top 10 nationally), the press footprint is surprisingly thin.

TRANSACTIONS (10 results):
• Individual sold listings on search.laughtonteam.com (IDX data)
• Notable: $1,700,000 commercial property sale in Avondale (former Bradley Academy Charter School, sold 02/18/2022)
  Source: https://search.laughtonteam.com/sold-listing/detail/1110930805/200-N-DYSART-Road-Avondale-AZ
• Homes.com summary: "Average sale price ~$470,000, price range $108K–$1.2M"
  Source: https://www.homes.com/real-estate-agents/george-laughton/25ekdeb/

SOCIAL/PROFESSIONAL PROFILES (4 results):
• LinkedIn (primary): https://www.linkedin.com/in/george-laughton-51506679
• LinkedIn (possible duplicate): https://www.linkedin.com/in/george-laughton-032892399 — listed as "Real Estate Agent at Zillow" in Mesa, AZ. Different entity? Worth investigating.
• Facebook: https://www.facebook.com/george.laughton.3/ (account temporarily blocked during crawl)
• Homes.com: Full profile with transaction data

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. STRATEGIC ASSESSMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

George Laughton is a textbook example of an agent with exceptional real-world credentials who is nearly invisible to AI systems.

STRENGTHS:
• 3,814 reviews at 5.0 stars — top 0.1% of all agents nationally by review volume
• $1.3B in total sales, 9,100+ families served
• 18 years experience, Top 1% nationally (8th largest mega team per RealTrends)
• Strong multi-platform presence (Zillow, Realtor.com, LinkedIn, personal site)

CRITICAL GAPS:
• AI does NOT cite him by name — even when prompted directly
• No schema markup on personal site — AI crawlers can't parse structured data
• Stale/no recency signal — AI sees no fresh data
• Thin press footprint — for a top-10 national team, surprisingly few independent articles
• No Google Business Profile detected

VALUE PROPOSITION:
At his current Listed tier (AIFS: 68), George is leaving significant AI visibility on the table. An Audited tier would push him to AIFS 95 — a +27 point lift — which directly translates to structured, verified data that AI systems can cite with confidence.

For an agent doing ~$260M/year in volume, even a fractional increase in AI-driven referrals would dwarf the $300-500/mo investment.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
END OF REPORT
Generated by Top10Lists.us Intelligence System
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

async function main() {
  const body = JSON.stringify({
    from_account: 'robert@top10lists.us',
    to: 'robert@aryah.ai',
    subject: 'Intelligence Report: George Laughton — Avondale, AZ (AIFS 68 → 95 potential)',
    message_body: report
  });

  const url = new URL(`${SB_URL}/functions/v1/gmail-send`);
  const req = https.request({
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      console.log(`Status: ${res.statusCode}`);
      console.log(`Response: ${data}`);
    });
  });
  req.on('error', err => console.error(`Error: ${err.message}`));
  req.write(body);
  req.end();
}

main();
