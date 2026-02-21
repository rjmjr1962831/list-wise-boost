# Batch signal score update – Gemini vs our schema

## Gemini’s intent (good)

- Set a **baseline** for listed agents (e.g. 0.45 weight, “Listed”).
- **Upgrade** confirmed (certified+) agents (e.g. 0.65 weight, “Certified”, consensus floor, signature).
- Set **consensus_sales_floor** = total_sales - 10.

## Why Gemini’s SQL can’t run as-is

| Gemini | Our schema |
|--------|------------|
| `agents` | **professionals** |
| `ai_confidence_weight` | We have **signal_score** (integer 0–100), not a 0.45-style weight |
| `signal_status` | We have **certifications.certification_tier** (certified / audited / underwritten) |
| `consensus_sales_floor` | We **compute** in artifact-payload as `(total_sales - 10)`; no column |
| `profile_confirmed` | We infer from **certifications**: active cert = “confirmed” |
| `crypto_signature_v1 = SHA2(...)` | **MySQL**; we’re **Postgres**. Signing is per-artifact (**payload_signature** on certifications), not a single SHA2 column |
| `SHA2(CONCAT(...), 256)` | In Postgres: `encode(sha256(...), 'hex')` |

So the *logic* (baseline for listed, higher for certified, consensus floor) is good; the *table and columns* don’t exist in our DB.

## Recommended approach (our schema)

1. **Do not add** `ai_confidence_weight`, `signal_status`, `consensus_sales_floor`, `profile_confirmed`, or `crypto_signature_v1` to match Gemini’s SQL.
2. **Use what we have:**  
   - **professionals** + **certifications** (agent_id, certification_tier, certification_status).  
   - **signal_score** (and optionally **audited_projected_signal**, **certified_projected_signal**) we added for this.
3. **Batch update only signal_score** (and optionally the two projected_signal columns) from tier:
   - No active certification → treat as listed → **signal_score = 45**
   - certified → **signal_score = 65**
   - audited / accredited → **signal_score = 80**
   - underwritten → **signal_score = 98**
4. **Consensus floor:** keep computing it in artifact-payload as `(total_sales - 10)`; no new column.
5. **Signing:** keep using existing artifact/certification signing; do not add a single SHA2 column.

## SQL that matches our schema (Postgres)

Run in Supabase SQL Editor (after the three signal columns exist on **professionals**):

```sql
-- 1) Listed: no active certification (or not in certifications) → baseline 45
UPDATE professionals p
SET signal_score = 45
WHERE p.active = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM certifications c
    WHERE c.agent_id = p.id AND c.certification_status = 'active'
  );

-- 2) Certified → 65
UPDATE professionals p
SET signal_score = 65
FROM certifications c
WHERE c.agent_id = p.id
  AND c.certification_status = 'active'
  AND c.certification_tier = 'certified';

-- 3) Audited (accredited) → 80
UPDATE professionals p
SET signal_score = 80
FROM certifications c
WHERE c.agent_id = p.id
  AND c.certification_status = 'active'
  AND c.certification_tier IN ('audited', 'accredited');

-- 4) Underwritten → 98
UPDATE professionals p
SET signal_score = 98
FROM certifications c
WHERE c.agent_id = p.id
  AND c.certification_status = 'active'
  AND c.certification_tier = 'underwritten';
```

Order matters: run 4 → 3 → 2 → 1 so underwritten wins, then audited, then certified, then listed. Or run in reverse order (1 then 2 then 3 then 4) so higher tiers overwrite; either way, each professional should be updated once by their highest tier.

Optional: backfill **audited_projected_signal** and **certified_projected_signal** in a second pass (e.g. set audited_projected_signal = 80 for certified agents, certified_projected_signal = 65 for audited/underwritten).
