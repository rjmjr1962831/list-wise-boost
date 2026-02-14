# Top10Lists.us - Technical Stack

## Current Data Sources

### Primary: State License Databases
- Coverage: 908,906 licenses loaded (AZ, CA, TX, FL, NY, CO)
- Purpose: Initial agent discovery and qualification
- Method: Direct scraping of state licensing boards
- Cost: Free (public data)
- Update Frequency: Monthly batch imports

### Secondary: Zillow Profile Enrichment
- Tool: Apify memo23 actor
- Purpose: Agent performance data (ratings, reviews, sales stats)
- Cost: ~$0.50/agent
- Success Rate: High for actively listed agents

### Tertiary: Exa.ai + DeepSeek
- Exa.ai API Key: 47a48609-5953-48d9-bed6-4010933b2940
- Purpose: Zillow profile ID discovery, press mentions
- DeepSeek: Content synthesis for Main tier (90% cost reduction)

## Potential Data Source: SourceRE ARELLO API

### Overview
Vendor: SourceRE
Standard: RESO Web API
Endpoint: https://api.sourceredb.com/odata/
Status: Evaluated, not implemented

### Available Resources
- Member (real estate agents/brokers - verified MLS data)
- Office (brokerages)
- Property (active listings)
- Team (agent teams)
- Media (photos and documents)

### Authentication
- JWT bearer tokens (1-year validity)
- Scoped per Feed (per MLS per Plan)
- Include in Authorization header

### Replication Strategy
1. Initial Bulk Load: Pull all records via @odata.nextLink pagination
2. Ongoing Updates: Poll hourly using APIModificationTimestamp filters
3. Deletions: Records marked DeletedInSource=true, visible for 48 hours
4. Metadata Refresh: Pull $metadata daily

### Rate Limits
- No concurrent requests
- Max 3 requests/second
- Max 5,000 requests/hour

### Cost Structure
Per-MLS Subscription Model:
- Vendor must purchase separate Plan for each MLS
- National coverage requires ~900 MLS subscriptions
- Pricing not publicly disclosed

### Pros vs Current Zillow Method

Advantages:
- Verified MLS transaction data (superior to Zillow estimates)
- Standardized RESO schema
- Official data source (no scraping concerns)
- Real-time updates (10-minute intervals)

Disadvantages:
- Only covers MLS-participating agents (subset of all licensed agents)
- Expensive at scale (hundreds of MLS subscriptions)
- Does not replace state license data
- Limited to agents with active MLS membership

### Recommendation
Phase 1 (Now): Continue Zillow scraping for broad coverage
Phase 2 (Post-Revenue): Purchase SourceRE access for priority markets
Use Case: Data quality upgrade for existing agents, not primary discovery
ROI Threshold: $5K+ monthly revenue to justify MLS subscription costs

### Implementation Blockers
1. Cost: Unknown but likely $500-2,000/month per MLS
2. Scope Mismatch: Need all 908,906 licensed agents, not just MLS members
3. Geographic Coverage: Would need 100+ MLS feeds for current 6-state footprint

Contact: support@sourceredb.com

## Database

Platform: Supabase PostgreSQL
Project ID: wiotrvoirdgzfacuuiem
Enrichment API: https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrichment-api

Query Limits:
- Default: 1,000 rows per query
- Always paginate for tables >1,000 records

## Frontend

Platform: Vercel
Framework: React SPA (Vite)
Routing: react-router-dom (FROZEN)

## Bot Rendering

Service: Cloudflare Workers
Worker: orange-truth-a103
Cache TTL: 24 hours

## Development Tools

Active:
- Cursor (code editing)
- Claude (senior developer)
- Gemini (strategist)

---

Last Updated: 2026-02-13
SourceRE ARELLO API documented as potential Phase 2 data source
