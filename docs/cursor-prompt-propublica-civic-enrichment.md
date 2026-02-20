# Cursor Prompt: Add ProPublica Civic Verification to Enrichment Pipeline

## Context

We have a working ProPublica IRS Form 990 civic verification script that searches for real estate agents by name in ProPublica's Nonprofit Explorer, finds verified board/officer positions from 990 filings, and writes them to the `community_roles` JSON field on the `professionals` table. It has been tested on 100 Arizona agents with zero false positives.

This needs to be integrated into the enrichment pipeline so every new agent automatically gets civic verification when they are added.

## Requirements

### 1. New Edge Function: `enrich-civic`

Create a new Supabase Edge Function at `supabase/functions/enrich-civic/index.ts` that:

- Accepts POST with body `{ "professional_id": "uuid" }` or `{ "batch": true, "state": "arizona", "limit": 50 }`
- For single agent: looks up the agent's `name` and `state_slug` from `professionals`, runs ProPublica search, updates `community_roles`
- For batch: fetches agents where `community_roles` does not contain any entry with `verification_source = 'ProPublica IRS Form 990'`, processes them
- Auth: `X-Enrichment-Key` header (same as enrichment-api)
- Rate limit: 1 request/second to ProPublica (be polite, it's a nonprofit)

### 2. ProPublica Search Logic

The search endpoint is **not a JSON API**. It returns HTML that must be parsed.

**Endpoint:** `https://projects.propublica.org/nonprofits/name_search?utf8=%E2%9C%93&q={url_encoded_name}`

**HTML parsing:** Split on `result-row result-row-people">` then extract from each block:

```
Person name:  regex: result-item__hed">\s*([^<]+)
Title:        regex: <span class="margin-right">\s*(.*?)\s*at\s*<a  (then strip HTML tags)
Org + EIN:    regex: href="/nonprofits/organizations/(\d+)">\s*([^<]+)
Year:         regex: •\s*<span[^>]*>(\d{4})</span>
Location:     regex: nowrap text-sub">\s*([^•<]+)
```

### 3. Name Matching

Normalize both names before comparing:
- Lowercase
- Remove suffixes: jr, sr, ii, iii, iv, esq, cpa, dds, md, phd
- Remove single-letter middle initials
- Collapse whitespace
- Require at least 2 word overlap between agent name and ProPublica result name

```python
# Example: "Robert J. Maynard Jr" normalizes to "robert maynard"
# Matches "Robert Maynard" but not "Robert Smith"
```

### 4. Role Classification (Critical - This Prevents False Positives)

A role is ACCEPTED only if ONE of these is true:

**Rule 1 - Org is in agent's state (by location string):**
- Arizona: location matches regex `,\s*AZ\b` (case insensitive) OR contains "arizona"
- California: location matches regex `,\s*CA\b` (case insensitive) OR contains "california"
- Add other states as we expand (TX, FL, NY, CO)

**Rule 2 - Org name explicitly references agent's state:**
```javascript
const STATE_ORG_TERMS = {
  arizona: ['arizona', 'maricopa county', 'pima county', 'pinal county', 
            'yavapai county', 'coconino county', 'mohave county'],
  california: ['california', 'los angeles county', 'san diego county', 
               'orange county', 'san francisco', 'sacramento county',
               'riverside county', 'san bernardino county', 'alameda county',
               'santa clara county', 'contra costa county', 'ventura county'],
  texas: ['texas', 'harris county', 'dallas county', 'tarrant county',
          'bexar county', 'travis county', 'collin county'],
  florida: ['florida', 'miami-dade county', 'broward county', 'palm beach county',
            'hillsborough county', 'orange county florida', 'duval county'],
  new_york: ['new york', 'manhattan', 'brooklyn', 'queens', 'bronx',
             'westchester county', 'nassau county', 'suffolk county'],
  colorado: ['colorado', 'denver county', 'el paso county', 'arapahoe county',
             'jefferson county', 'adams county', 'douglas county'],
}
```

**Rule 3 - Org is a national real estate body (accept from any state):**
```javascript
const NATIONAL_RE_BODIES = [
  'national association of realtors',
  'national association of home builders',
  'national fair housing alliance',
  'habitat for humanity international',
  'urban land institute',
]
```

**Everything else is REJECTED.** This is strict on purpose. Common names like "Jim Brown" or "David Brown" return 25+ results from all over the country. Without strict filtering, you get a Jim Brown in Arizona credited with being on a VFW board in Pennsylvania.

### 5. Data Format

Each verified role is stored as an object in the `community_roles` JSON array:

```json
{
  "role": "Director",
  "organization": "Arizona Association Of Realtors",
  "verification_source": "ProPublica IRS Form 990",
  "ein": "860080497",
  "tax_year": "2023",
  "location": "Phoenix, AZ",
  "filing_url": "https://projects.propublica.org/nonprofits/organizations/860080497"
}
```

**Merge rules:**
- Do NOT overwrite existing community_roles. Append to the array.
- Deduplicate by organization name (case-insensitive). If the org already exists in the array, skip it.
- Deduplicate by EIN within a single search result set.

### 6. Skip Logic

Skip agents where:
- Name has fewer than 2 words
- Name contains business terms: 'realty', 'group', 'team', 'homes', 'properties', 'llc', 'inc'
- Agent already has at least one role with `verification_source: 'ProPublica IRS Form 990'` (already enriched)

### 7. Integration Points

**A. After promote_to_professional:** When a new agent is promoted from `state_licenses` to `professionals`, call `enrich-civic` as the final enrichment step.

**B. Batch endpoint for backfill:** The `{ "batch": true, "state": "arizona", "limit": 50 }` mode lets us run it on existing agents that haven't been checked yet. This can be called by cron or manually.

**C. enrichment-api integration:** Add `?action=enrich-civic` to the existing enrichment-api Edge Function as an alternative to a standalone function. Either approach works. The key is that it's callable both individually (single agent) and in batch.

### 8. Edge Function Skeleton

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ENRICHMENT_KEY = Deno.env.get('ENRICHMENT_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const PROPUBLICA_SEARCH = 'https://projects.propublica.org/nonprofits/name_search'

// STATE_CONFIG, NATIONAL_RE_BODIES, classify_role, names_match, etc. go here
// Port the Python logic from propublica_full_run.py

serve(async (req) => {
  // Auth check
  const authKey = req.headers.get('X-Enrichment-Key')
  if (authKey !== ENRICHMENT_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const body = await req.json()
  
  if (body.professional_id) {
    // Single agent mode
    // 1. Fetch agent from professionals table
    // 2. Search ProPublica
    // 3. Filter results
    // 4. Merge and update
  } else if (body.batch) {
    // Batch mode
    // 1. Fetch agents without ProPublica verification
    // 2. Process up to body.limit (default 10, max 50)
    // 3. Rate limit 1 req/sec
    // 4. Return summary
  }
})
```

### 9. Testing

Before deploying, test with these known results from our 100-agent Arizona test:

| Agent Name | Expected Result |
|-----------|----------------|
| Sally Liddicoat | 3 roles: NAR (Chicago, IL), West Maricopa Realtors (Peoria, AZ), AZ Association of Realtors (Phoenix, AZ) |
| Allison Cahill | 4 roles: AZ Assoc of Realtors, NAR, Scottsdale Area Assoc of Realtors, Scottsdale Arts |
| Jim Brown | 1 role ONLY: Science Center of Inquiry (Gilbert, AZ). Must NOT include VFW Pennsylvania or Young Parents Iowa. |
| Carol Anne Teague | 1 role: Jerome Historical Society (Jerome, AZ) |
| David Brown | 0 roles (all results are out-of-state, different people) |

If Jim Brown or David Brown get more than their expected count, the filtering is too loose.

### 10. Deployment

```bat
C:\Users\rober\supabase.exe functions deploy enrich-civic --project-ref wiotrvoirdgzfacuuiem --no-verify-jwt
```

Set secrets if not already present:
```bat
C:\Users\rober\supabase.exe secrets set ENRICHMENT_KEY=t10l_enrich_0448c4870d72ed90fd43171123fd0e44558f019a2b5807d1b297604dad6b235a --project-ref wiotrvoirdgzfacuuiem
```

### 11. Reference Implementation

The complete working Python implementation is in `propublica_full_run.py` (in the repo or ask Claude for it). Port the logic to TypeScript/Deno for the Edge Function. The critical functions to port are:

- `search_propublica_people()` - HTML fetch and parse
- `classify_role()` - the three-rule filter
- `names_match()` with `normalize_name()` - name comparison
- `merge_roles()` - deduplication and append

### 12. Important Notes

- ProPublica name_search returns MAX 25 results per page. For common names this means we might miss some. This is acceptable; we optimize for precision over recall.
- ProPublica is a nonprofit. Rate limit to 1 req/sec. Do not parallelize requests.
- The `User-Agent` header must be a real browser UA string or ProPublica may block the request.
- HTML structure could change. If the parser starts returning 0 results for known-good names, the HTML format has changed and the regexes need updating.
