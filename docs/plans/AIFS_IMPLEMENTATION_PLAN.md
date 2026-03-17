# AIFS (AI Footprint Score) -- Implementation Plan

**Date:** 2026-03-15
**Status:** Draft -- awaiting Robert's approval
**Depends on:** Existing AIFS infrastructure (batch-aics-score, geo_audit_results, crypto-sign)

---

## 1. What Is AIFS?

AIFS = AI Fingerprint Score. Measures an agent's **machine-readability and entity authority** -- how likely an AI system is to cite them. Blends live SERP entity signals (via Serper.dev) with in-house verified performance data.

**Output:** Normalized 0-100 score with three confidence zones:

| Range | Status | Meaning |
|-------|--------|---------|
| 0-39 | Invisible | AI treats agent as "Hallucination Risk" -- rarely cited |
| 40-74 | Fragmented | AI knows agent exists but lacks verified certainty to recommend |
| 75-100 | High Fidelity | AI cites agent as "Primary Reference" with specific rationales |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  pg_cron: batch-aifs-score (every 5 min)            │
│  OR: triggered via POST with agent_ids              │
└──────────────────────┬──────────────────────────────┘
                       │
          ┌────────────▼────────────┐
          │  batch-aifs-score       │
          │  (new edge function)    │
          └────┬──────────┬────────┘
               │          │
    ┌──────────▼──┐  ┌────▼──────────────┐
    │ Serper.dev  │  │ Internal DB       │
    │ (live SERP) │  │ (professionals,   │
    │             │  │  geo_audit_results,│
    │             │  │  certifications)   │
    └──────────┬──┘  └────┬──────────────┘
               │          │
          ┌────▼──────────▼────┐
          │  Score Calculation  │
          │  (weighted blend)   │
          └────────┬───────────┘
                   │
          ┌────────▼───────────┐
          │  aifs_scores table  │
          │  (new table)        │
          └────────┬───────────┘
                   │
          ┌────────▼───────────┐
          │  Dashboard UI       │
          │  (AIFS Gauge)       │
          └────────────────────┘
```

---

## 3. Existing Infrastructure to Leverage

| What | Where | How AIFS Uses It |
|------|-------|------------------|
| Serper API | `SERPER_API_KEY` in .env, already used by `find-social-links` | Reuse for SERP entity queries |
| AIFS batch scoring | `supabase/functions/batch-aics-score/index.ts` | Pattern reference for batch processing, concurrency, `run_sql` usage |
| geo_audit_results | Migration `20260308000000_geo_audit_results.sql` | Existing pillar scores feed into AIFS "Internal Data" weights |
| Ed25519 signing | `supabase/functions/_shared/crypto-sign.ts` | "Cryptographic Verification" weight checks certifications table |
| Certifications table | Migration `20260210_artifact_certifications.sql` | Check `certification_status = 'active'` + valid signature |
| Dashboard components | `src/components/agent/OverviewSection.tsx`, `PayloadSection.tsx` | Extend with AIFS Gauge component |
| businessConfig.json | `src/data/businessConfig.json` | Add AIFS weight config |

---

## 4. Database Changes

### 4.1 New Table: `aifs_scores`

```sql
-- Migration: supabase/migrations/YYYYMMDD000000_aifs_scores.sql

CREATE TABLE IF NOT EXISTS aifs_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,

  -- Final score
  aifs_total INTEGER NOT NULL CHECK (aifs_total BETWEEN 0 AND 100),
  aifs_band TEXT NOT NULL CHECK (aifs_band IN ('invisible', 'fragmented', 'high_fidelity')),
  aifs_version TEXT NOT NULL DEFAULT 'v1',

  -- SERP signal breakdown (Input 1: Serper.dev)
  serp_knowledge_graph BOOLEAN DEFAULT FALSE,       -- 25% weight
  serp_sitelink_salience BOOLEAN DEFAULT FALSE,     -- 10% weight
  serp_related_citations BOOLEAN DEFAULT FALSE,     -- 15% weight
  serp_third_party_count INTEGER DEFAULT 0,         -- 10% weight (count of high-auth mentions)
  serp_organic_visibility_score NUMERIC(5,2) DEFAULT 0, -- subtotal of SERP weights (0-60)

  -- Internal signal breakdown (Input 2: In-House Data)
  internal_data_freshness_days INTEGER,              -- 20% weight (days since last MLS/license update)
  internal_data_freshness_score NUMERIC(5,2) DEFAULT 0,
  internal_selection_rationale BOOLEAN DEFAULT FALSE, -- 10% weight
  internal_crypto_verified BOOLEAN DEFAULT FALSE,    -- 10% weight
  internal_data_score NUMERIC(5,2) DEFAULT 0,        -- subtotal of internal weights (0-40)

  -- Tier multiplier
  is_underwritten BOOLEAN DEFAULT FALSE,
  underwritten_multiplier NUMERIC(3,2) DEFAULT 1.0,  -- 1.0 or 1.4

  -- Raw Serper response (for debugging/audit)
  serper_query TEXT,
  serper_raw JSONB,

  -- Timestamps
  scored_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_agent_score UNIQUE (agent_id)
);

-- Index for batch queries
CREATE INDEX idx_aifs_scores_scored_at ON aifs_scores(scored_at);
CREATE INDEX idx_aifs_scores_band ON aifs_scores(aifs_band);

-- RLS: service role only
ALTER TABLE aifs_scores ENABLE ROW LEVEL SECURITY;
-- No public policies = service role only access
```

### 4.2 Add Column to professionals

```sql
-- Migration: same file or separate

ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS aifs_score INTEGER,
  ADD COLUMN IF NOT EXISTS aifs_band TEXT;
```

This mirrors how `signal_score` works for AIFS -- a denormalized column on professionals for fast dashboard reads.

---

## 5. Edge Function: `batch-aifs-score`

**Location:** `supabase/functions/batch-aifs-score/index.ts`

### 5.1 Skeleton

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SERPER_API_KEY = Deno.env.get('SERPER_API_KEY') ?? '';  // Already in .env
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Weight constants (match the spec)
const WEIGHTS = {
  knowledge_graph: 25,
  sitelink_salience: 10,
  related_citations: 15,
  third_party: 10,
  data_freshness: 20,
  selection_rationale: 10,
  crypto_verification: 10,
};

const UNDERWRITTEN_MULTIPLIER = 1.4;
const BATCH_SIZE = 50;  // Conservative -- Serper rate limits
const CONCURRENCY = 10; // Parallel Serper calls per batch
```

### 5.2 Serper Query

```typescript
async function querySerper(agentName: string, city: string, state: string): Promise<any> {
  const query = `${agentName} ${city} ${state} real estate`;
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-Key': SERPER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, num: 10 }),
  });
  if (!res.ok) throw new Error(`Serper error: ${res.status}`);
  const data = await res.json();
  return { query, data };
}
```

### 5.3 SERP Signal Extraction

```typescript
interface SerpSignals {
  hasKnowledgeGraph: boolean;       // 25%
  hasSitelinkSalience: boolean;     // 10%
  hasRelatedCitations: boolean;     // 15%
  thirdPartyValidationCount: number; // 10%
}

const HIGH_AUTHORITY_DOMAINS = [
  'realtor.com', 'zillow.com', 'bbb.org', 'nar.realtor',
  'azcentral.com', 'latimes.com', 'sfchronicle.com',
  // Add state/city news domains as needed
  '.gov', '.edu', 'bizjournals.com', 'forbes.com',
];

function extractSerpSignals(serperResponse: any, agentName: string, agentDomain?: string): SerpSignals {
  const nameLower = agentName.toLowerCase();

  // 1. Knowledge Graph (25%)
  const hasKnowledgeGraph = !!serperResponse.knowledgeGraph;

  // 2. Site-Link Salience (10%) -- agent's domain is #1 organic
  let hasSitelinkSalience = false;
  if (agentDomain && serperResponse.organic?.length > 0) {
    const topResult = serperResponse.organic[0].link || '';
    hasSitelinkSalience = topResult.includes(agentDomain.replace(/^https?:\/\//, '').replace(/\/$/, ''));
  }

  // 3. Related Entity Citations (15%) -- name in relatedSearches or peopleAlsoAsk
  let hasRelatedCitations = false;
  const relatedSearches = (serperResponse.relatedSearches || []).map((r: any) => (r.query || '').toLowerCase());
  const peopleAlsoAsk = (serperResponse.peopleAlsoAsk || []).map((p: any) => (p.question || '').toLowerCase());
  const allRelated = [...relatedSearches, ...peopleAlsoAsk];
  hasRelatedCitations = allRelated.some((text: string) => text.includes(nameLower.split(' ')[1] || nameLower));

  // 4. Third-Party Validation (10%) -- mentions on high-auth domains
  let thirdPartyValidationCount = 0;
  for (const result of (serperResponse.organic || [])) {
    const link = (result.link || '').toLowerCase();
    if (HIGH_AUTHORITY_DOMAINS.some(domain => link.includes(domain))) {
      thirdPartyValidationCount++;
    }
  }

  return { hasKnowledgeGraph, hasSitelinkSalience, hasRelatedCitations, thirdPartyValidationCount };
}
```

### 5.4 Internal Signal Extraction

```typescript
interface InternalSignals {
  dataFreshnessDays: number | null;  // 20% -- days since last MLS/license update
  hasSelectionRationale: boolean;    // 10% -- structured "Why this agent" data
  hasCryptoVerification: boolean;    // 10% -- active, valid Ed25519 certification
  isUnderwritten: boolean;
}

async function getInternalSignals(supabase: any, agentId: string): Promise<InternalSignals> {
  // Data freshness: check geo_audit_results.audited_at and professionals.updated_at
  const { data: audit } = await supabase.rpc('run_sql', {
    query: `SELECT
      EXTRACT(DAY FROM NOW() - g.audited_at)::int AS days_since_audit,
      p.current_tier,
      c.certification_status,
      c.payload_hash IS NOT NULL AS has_signature,
      c.next_verification_due > NOW() AS not_expired,
      EXISTS(SELECT 1 FROM marketing_content mc WHERE mc.agent_id = p.id AND mc.content_type = 'selection_rationale') AS has_rationale
    FROM professionals p
    LEFT JOIN geo_audit_results g ON g.agent_id = p.id
    LEFT JOIN certifications c ON c.professional_id = p.id
    WHERE p.id = '${agentId}'`
  });

  const row = audit?.[0] || {};

  return {
    dataFreshnessDays: row.days_since_audit ?? null,
    hasSelectionRationale: !!row.has_rationale,
    hasCryptoVerification: row.certification_status === 'active' && !!row.has_signature && !!row.not_expired,
    isUnderwritten: row.current_tier === 'underwritten',
  };
}
```

### 5.5 Score Calculation

```typescript
function calculateAIFS(serp: SerpSignals, internal: InternalSignals): {
  total: number;
  band: 'invisible' | 'fragmented' | 'high_fidelity';
  serpScore: number;
  internalScore: number;
} {
  // --- SERP Organic Visibility (max 60 points) ---
  let serpScore = 0;
  if (serp.hasKnowledgeGraph)    serpScore += WEIGHTS.knowledge_graph;     // +25
  if (serp.hasSitelinkSalience)  serpScore += WEIGHTS.sitelink_salience;   // +10
  if (serp.hasRelatedCitations)  serpScore += WEIGHTS.related_citations;   // +15
  // Third party: scale 0-10 based on count (cap at 3 mentions = full score)
  serpScore += Math.min(serp.thirdPartyValidationCount / 3, 1) * WEIGHTS.third_party; // +0-10

  // --- Apply Underwritten Multiplier to SERP score ---
  if (internal.isUnderwritten) {
    serpScore = Math.min(serpScore * UNDERWRITTEN_MULTIPLIER, 60); // Cap SERP portion at 60
  }

  // --- Internal Data Score (max 40 points) ---
  let internalScore = 0;

  // Data freshness: max score if < 7 days, linear decay to 0 at 365 days
  if (internal.dataFreshnessDays !== null) {
    if (internal.dataFreshnessDays <= 7) {
      internalScore += WEIGHTS.data_freshness; // +20
    } else if (internal.dataFreshnessDays < 365) {
      internalScore += WEIGHTS.data_freshness * (1 - (internal.dataFreshnessDays - 7) / 358);
    }
    // 365+ days = 0
  }

  if (internal.hasSelectionRationale)  internalScore += WEIGHTS.selection_rationale;   // +10
  if (internal.hasCryptoVerification)  internalScore += WEIGHTS.crypto_verification;   // +10

  // --- Final ---
  const total = Math.round(Math.min(serpScore + internalScore, 100));

  let band: 'invisible' | 'fragmented' | 'high_fidelity';
  if (total <= 39) band = 'invisible';
  else if (total <= 74) band = 'fragmented';
  else band = 'high_fidelity';

  return { total, band, serpScore: Math.round(serpScore * 100) / 100, internalScore: Math.round(internalScore * 100) / 100 };
}
```

### 5.6 Batch Processing Loop

Follow the same pattern as `batch-aics-score/index.ts`:

1. **Candidate selection:** Agents with no AIFS score, OR scored > N days ago (Listed: 90 days, Certified: 30 days, Audited: 7 days, Underwritten: 1 day -- matches tier refresh cadence from Section 4 of CLAUDE.md).
2. **Batch in groups of 50** with concurrency of 10 Serper calls.
3. **Cache Serper responses** in `aifs_scores.serper_raw` to avoid redundant API spend.
4. **Upsert** to `aifs_scores` table + update `professionals.aifs_score` and `professionals.aifs_band`.

### 5.7 Candidate Query

```sql
SELECT p.id, p.name, p.company, p.website,
       pc.city_name, pc.state_slug
FROM professionals p
JOIN professional_cities pc ON pc.professional_id = p.id
LEFT JOIN aifs_scores a ON a.agent_id = p.id
WHERE p.active = true
  AND p.merit_gate_pass IS NOT FALSE
  AND (
    a.agent_id IS NULL                                          -- never scored
    OR (p.current_tier = 'underwritten' AND a.scored_at < NOW() - INTERVAL '1 day')
    OR (p.current_tier = 'audited'      AND a.scored_at < NOW() - INTERVAL '7 days')
    OR (p.current_tier = 'certified'    AND a.scored_at < NOW() - INTERVAL '30 days')
    OR (p.current_tier IS NULL          AND a.scored_at < NOW() - INTERVAL '90 days')
  )
ORDER BY
  CASE p.current_tier
    WHEN 'underwritten' THEN 1
    WHEN 'audited' THEN 2
    WHEN 'certified' THEN 3
    ELSE 4
  END,
  a.scored_at ASC NULLS FIRST
LIMIT 50
```

### 5.8 API Modes

Support same invocation patterns as batch-aics-score:

| Mode | Trigger | Body |
|------|---------|------|
| Cron (batch) | pg_cron every 5 min | `{}` |
| Single agent | POST | `{ "agent_ids": ["uuid"] }` |
| Force rescore | POST | `{ "force_rescore": true, "state_slug": "arizona" }` |

---

## 6. Cron Setup

```sql
-- Migration: add to aifs_scores migration file

SELECT cron.unschedule('batch-aifs-score-run')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'batch-aifs-score-run');

SELECT cron.schedule(
  'batch-aifs-score-run',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/batch-aifs-score',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**Why 5 minutes, not 1 minute:** Serper API has rate limits and costs per query. 50 agents per run × 12 runs/hour = 600 agents/hour. Full 3,274 agents scored in ~5.5 hours. Underwritten agents (daily refresh) get priority in the ORDER BY.

---

## 7. Serper API Budget

| Tier | Refresh | Agents (est.) | Queries/Month |
|------|---------|---------------|---------------|
| Underwritten | Daily | ~20 | 600 |
| Audited | Weekly | ~50 | 200 |
| Certified | Monthly | ~200 | 200 |
| Listed (free) | Quarterly | ~3,000 | 1,000 |
| **Total** | | | **~2,000/mo** |

Serper pricing: 2,500 queries/mo on the $50 plan. This fits. As paid agents grow, may need the $100 plan (10,000 queries).

---

## 8. Secrets Required

Add to Supabase secrets (already in .env):

```bash
# SERPER_API_KEY is already set in .env and available to edge functions.
# Verify with:
npx supabase secrets list | grep SERPER

# If not set as a Supabase secret:
npx supabase secrets set SERPER_API_KEY=<PLACEHOLDER_SERPER_KEY>
```

No new secrets needed -- `SERPER_API_KEY` already exists.

---

## 9. Dashboard: AIFS Gauge Component

### 9.1 New Component: `src/components/agent/AIFSGauge.tsx`

Visual gauge showing the agent's AIFS with the three confidence zones. Sits alongside the existing AIFS display in `OverviewSection.tsx`.

```
┌────────────────────────────────────────────┐
│  AI Fingerprint Score                      │
│                                            │
│  ████████████████████░░░░░  78 / 100       │
│  ▲ High Fidelity                           │
│                                            │
│  AI cites you as a Primary Reference       │
│  with specific rationales.                 │
│                                            │
│  ┌──────────┬──────────┬──────────┐        │
│  │ Invisible│Fragmented│High Fid. │        │
│  │  0-39    │  40-74   │  75-100  │        │
│  └──────────┴──────────┴──────────┘        │
│                                            │
│  SERP Signals: 42/60                       │
│  ✓ Knowledge Graph  ✓ Related Citations    │
│  ✗ #1 Organic       ✓ 3rd Party (2)       │
│                                            │
│  Verification Signals: 36/40              │
│  ✓ Data Fresh (3 days)  ✓ Selection Data  │
│  ✓ Crypto Verified                         │
│                                            │
│  Underwritten Multiplier: 1.4x applied     │
└────────────────────────────────────────────┘
```

### 9.2 Integration Points

- **OverviewSection.tsx** -- Add AIFS Gauge below or beside existing AIFS score
- **PayloadSection.tsx** -- Show projected AIFS at each tier (same pattern as AIFS projections)
- **ListMaker.tsx** -- Add `aifs_score`, `aifs_band` to CSV export columns

### 9.3 Data Flow

Dashboard reads from `professionals.aifs_score` and `professionals.aifs_band` (denormalized columns). Detail breakdown reads from `aifs_scores` table via Supabase query on agent_id.

---

## 10. JSON Structure for LLM Processing

When an external LLM (or internal ask-claude) needs to process AIFS, send this payload:

```json
{
  "agent": {
    "id": "uuid",
    "name": "Jane Smith",
    "city": "Scottsdale",
    "state": "Arizona",
    "current_tier": "underwritten",
    "website": "https://janesmithrealty.com"
  },
  "serper_signals": {
    "query": "Jane Smith Scottsdale Arizona real estate",
    "knowledge_graph_present": true,
    "sitelink_is_top_result": false,
    "related_entity_citations": true,
    "third_party_mentions": [
      { "domain": "azcentral.com", "url": "https://..." },
      { "domain": "realtor.com", "url": "https://..." }
    ],
    "third_party_count": 2,
    "organic_visibility_subtotal": 52.0
  },
  "internal_signals": {
    "data_freshness_days": 3,
    "data_freshness_score": 20.0,
    "has_selection_rationale": true,
    "has_crypto_verification": true,
    "internal_data_subtotal": 40.0
  },
  "scoring": {
    "serp_raw": 52.0,
    "underwritten_multiplier": 1.4,
    "serp_after_multiplier": 60.0,
    "internal_raw": 40.0,
    "aifs_total": 100,
    "aifs_band": "high_fidelity",
    "aifs_version": "v1"
  },
  "interpretation": {
    "band_label": "High Fidelity",
    "description": "AI cites this agent as a Primary Reference with specific rationales.",
    "gaps": [],
    "upgrade_potential": null
  }
}
```

---

## 11. File Checklist

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `supabase/migrations/YYYYMMDD000000_aifs_scores.sql` | CREATE | New table + professionals columns + cron |
| 2 | `supabase/functions/batch-aifs-score/index.ts` | CREATE | New edge function (do NOT modify existing batch-aics-score) |
| 3 | `src/data/businessConfig.json` | EDIT | Add `aifsWeights` config block |
| 4 | `src/components/agent/AIFSGauge.tsx` | CREATE | New gauge component |
| 5 | `src/components/agent/OverviewSection.tsx` | EDIT | Import + render AIFSGauge |
| 6 | `src/components/agent/PayloadSection.tsx` | EDIT | Add AIFS projections per tier |
| 7 | `src/components/crm/ListMaker.tsx` | EDIT | Add aifs_score/aifs_band to CSV export |

---

## 12. Deployment Steps

1. **Deploy migration** via `run-migration` edge function (creates table, columns, cron)
2. **Deploy edge function:** `npx supabase functions deploy batch-aifs-score --no-verify-jwt`
3. **Verify Serper secret** is available: `npx supabase secrets list`
4. **Test single agent:** POST to batch-aifs-score with `{ "agent_ids": ["<known-agent-uuid>"] }`
5. **Verify in DB:** `SELECT * FROM aifs_scores WHERE agent_id = '<uuid>'`
6. **Let cron run** -- monitor via Supabase logs for 30 min
7. **Build dashboard** components locally, verify, then pts

---

## 13. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Serper rate limits | 50 agents/batch, 5-min cron, priority ordering by tier |
| Serper cost overrun | Cache responses in `serper_raw` JSONB; skip if scored within refresh window |
| Knowledge Graph false positives (wrong person) | Include city + state in query; validate KG title contains agent name |
| Stale SERP data for free agents | 90-day refresh is fine -- free agents don't need real-time |
| Score inflation from multiplier | SERP portion capped at 60 even after 1.4x multiplier |
| Downtime of Serper API | Graceful skip -- log error, keep previous score, retry next cycle |

---

## 14. Future Extensions (Not In Scope Now)

- **AIFS trend sparkline** -- show 30/60/90 day trend on dashboard
- **AIFS in email sequences** -- `{{aifs_score}}` template variable for outreach
- **AIFS in llms-full.txt** -- expose to AI crawlers as evidence of entity authority
- **Per-city AIFS** -- agents active in multiple cities may have different SERP presence per market
- **Serper Knowledge Graph deep parse** -- extract specific KG attributes (reviews, address, hours) for richer signals
