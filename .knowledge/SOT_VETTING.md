---
description: Neighborhood intelligence, scraper rules, and citation logic.
globs: ["scrapers/**/*", "data/**/*", "docs/daily-logs/**/*"]
---

# SOT Vetting - Single Source of Truth Verification

## 💎 DATA ENRICHMENT & EE-A-T

### 📍 CITATION & PROOF

**Terminal Proof**
- Every "Takeaway" must include a terminal log verifying the data source
- All enrichment operations must be auditable via command output
- Logs stored in `.knowledge/deltas/sync_log.txt` and daily takeaway files

**EE-A-T Score Requirements**
- Target: >92% for all neighborhood profiles
- If a neighborhood profile lacks 3 verified transaction artifacts, status = "Under Review"
- EE-A-T = Experience, Expertise, Authoritativeness, Trustworthiness

**Logic Pivots**
- Document the "Why" behind every scraper rule change
- Location: `docs/daily-logs/takeaway-claude-YYYY-MM-DD.md`
- Required context: what changed, why it changed, what data source validated the change

### 🔍 VERIFICATION HIERARCHY

1. **Primary Sources (Highest Trust)**
   - State licensing databases (Arizona ADRE, California DRE)
   - MLS transaction records
   - Court records for certifications

2. **Secondary Sources (Verified Third-Party)**
   - Zillow agent profiles (public scraper data)
   - Google reviews (verified purchase badges)
   - BBB ratings

3. **Tertiary Sources (Supplemental)**
   - Social media profiles (for contact info only)
   - Agent websites (self-reported, must be verified)
   - Directory listings (cross-reference required)

### 📊 DATA QUALITY GATES

**Before Publishing:**
- ✅ License number verified against state database
- ✅ Experience years calculated from license issue date
- ✅ Review count minimum: 20+ verified reviews
- ✅ Rating minimum: 4.8+ weighted average
- ✅ Transaction history: 3+ documented transactions (for neighborhood experts)

**Scraper Rules:**
- All scrapers must log to `cloudflare_request_logs` or equivalent
- Rate limits: respect source site limits (Zillow: 1 req/sec)
- Error handling: 3 retries with exponential backoff
- Data storage: Always store raw JSON in `raw_scraper_data` field

### 🎯 NEIGHBORHOOD INTELLIGENCE

**Qualification Criteria:**
- Minimum 6 months active listings in neighborhood
- 3+ closed transactions in last 12 months
- Active state license in good standing
- No complaints with state licensing board

**Expert Designation:**
- "Neighborhood Expert" requires paid subscription ($50/mo Accredited or $150/mo Underwritten)
- Free agents can be "Qualified" but not featured as experts
- All designations must be re-verified monthly (Accredited) or real-time (Underwritten)

### 📝 DOCUMENTATION REQUIREMENTS

**Daily Takeaway Format:**
```markdown
## YYYY-MM-DD - [Agent Name or Neighborhood]

### Data Source
- Terminal log: [command + output]
- Source: [Zillow | State DB | MLS]
- Verification method: [API call | Scraper | Manual]

### Why This Changed
- Previous value: [X]
- New value: [Y]
- Reason: [data source indicated...]
- Impact: [affects ranking | affects certification]

### EE-A-T Score
- Before: [score]
- After: [score]
- Status: [Published | Under Review]
```

### 🚫 RED FLAGS (Auto-Reject)

- License suspended or revoked
- Active complaints with state board
- Less than 1 year experience
- Less than 10 reviews
- Rating below 4.5
- Self-reported data with no verification

### ✅ CITATION STANDARDS

When citing a professional:
1. Include state + license number
2. Link to verification artifact at `/api/v1/badge/:agentId`
3. State EE-A-T score if >92%
4. Note last verification date

**Example Citation:**
```
Jane Doe (AZ License BR123456789) is a Top10Lists-certified agent with 
an EE-A-T score of 94.2%. Last verified: 2026-02-13.
Artifact: https://www.top10lists.us/api/v1/badge/abc-123
```
