import { readFileSync } from 'fs';

const envFile = readFileSync('C:/Users/rober/list-wise-boost/.env', 'utf8');
const env = Object.fromEntries(
  envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => {
    const i = l.indexOf('=');
    return [l.slice(0, i), l.slice(i + 1)];
  })
);

const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const body = `ENTITY RESEARCH REPORT: Jeff Sibbach
Compiled: March 14, 2026
Sources: Serper.dev, ADRE, LinkedIn, Zillow, AZ Foothills Magazine, Inman


=== INDIVIDUAL ===

Full Name:                  Jeffrey Michael Sibbach
First Name:                 Jeffrey
Middle Name:                Michael
Last Name:                  Sibbach
Family Name:                Sibbach
Gender:                     Male
Age:                        ~53-54 (born ~1972; AZ Foothills Mag listed age 44 in ~2017)
Age Range:                  50-55
Birthday:                   Not found (year ~1972 inferred from Penn State Class of 1994)


=== LOCATION ===

Location General:           North Scottsdale, Arizona
City:                       Scottsdale
Region:                     Arizona
Region Code:                AZ
Country:                    United States
Country Code:               US


=== EDUCATION ===

Education Name:             Pennsylvania State University (Penn State)
Education Degree:           Bachelor's — International Politics
Education Year:             1994 (attended 1990-1994, Class of 1994)


=== PROFESSIONAL ===

Current Organization Name:  Sibbach Team — eXp Realty
Current Organization Title: Team Lead / Founder
Current Organization Indicator: Active (AZ License SA536153000, issued 9/10/2002)


=== SOCIAL PROFILES ===

Twitter URL:                https://x.com/thesibbach
Twitter Bio:                "Passionate about my kids, family, real estate, and the Phoenix Suns" (joined April 2014)

LinkedIn URL:               https://www.linkedin.com/in/jeffsibbach/
LinkedIn Bio:               Team Lead at Sibbach Team - eXp Realty. Built a top real estate team. #1 Agent Phoenix-Metro 2018 (PBJ). Inman Innovator finalist 2016-2018. Top 1/10 of 1% in Maricopa County for sales volume.

Social Profile Photo URL:   Not available from public search (LinkedIn/FB require auth)
Social Profile Photo Label: N/A


=== SYNTHESIS ===

Jeff Sibbach is a top-tier Scottsdale real estate agent with 23 years of experience. Penn State grad (International Politics, 1994) who entered real estate in 2002 and reached the top 1% in Arizona by 2005.

Key stats:
- #1 Agent in Phoenix-Metro (Phoenix Business Journal, 2018) out of 50,000 agents
- Top 1/10 of 1% in Maricopa County by sales volume
- 1,506 Zillow reviews at 5.0 stars (Best of Zillow designation)
- Inman Most Innovative Agent/Team finalist 2016, 2017, 2018 — only AZ agent
- RealTrends Top 60 team in America (2020, 2021)
- #1 AZ Real Estate Team 3 consecutive years (Ranking Arizona 2014-2016)
- Inman News contributor (published articles on RE trends)
- Also founder of AgentTruth and Real Estate Leopard
- Moved from Realty One Group to eXp Realty in 2019
- Married to Lynn, two children (Kenzie, Jackson)
- AI-forward: Facebook profile branded "AI-Jeff Sibbach"

Entity strength: Very high. Strong NAP consistency, 6+ active social platforms, extensive third-party corroboration (Inman, PBJ, RealTrends, Zillow, Yelp, BBB), published thought leadership.`;

const res = await fetch('https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/gmail-send', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from_account: 'robert@toptenlists.us',
    to: 'robert@aryah.ai',
    subject: 'Entity Research Report: Jeff Sibbach — Scottsdale, AZ',
    message_body: body,
  }),
});

const data = await res.json();
console.log('Status:', res.status);
console.log('Response:', JSON.stringify(data, null, 2));
