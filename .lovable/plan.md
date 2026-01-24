

# California Neighborhood Pipeline Fix

## Summary

This is a **4-step plan with NO deletions**. We will:
1. Create the `pipeline_alerts` table for database-based logging
2. Replace `populate-ca-neighborhoods/index.ts` with v2 code
3. Reset the stalled pipeline state
4. Restart the pipeline

---

## Current State (Confirmed via Database Query)

| Metric | Value |
|--------|-------|
| Pipeline status | `running` (but stalled) |
| Last update | 2026-01-24 04:15:02 (~14 hours ago) |
| Cities processed | 42 of 1,591 |
| Last city | Antelope |
| CA neighborhoods created | 68 |
| Errors | 0 |

The pipeline is stuck because `triggerNextBatch()` in v1 silently fails after processing Antelope.

---

## Step 1: Create `pipeline_alerts` Table

**Type:** Database migration

**SQL:**
```sql
CREATE TABLE IF NOT EXISTS pipeline_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  title TEXT NOT NULL,
  message TEXT,
  metadata JSONB DEFAULT '{}',
  acknowledged BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pipeline_alerts_lookup 
  ON pipeline_alerts (pipeline, acknowledged, created_at DESC);

CREATE INDEX idx_pipeline_alerts_unacked_critical 
  ON pipeline_alerts (created_at DESC) 
  WHERE severity IN ('error', 'critical') AND acknowledged = false;
```

**Purpose:** Replace unreliable SMTP email alerts with queryable database logs.

---

## Step 2: Replace Edge Function with v2

**Type:** File modification

**File:** `supabase/functions/populate-ca-neighborhoods/index.ts`

**Key improvements in v2:**

| Issue | v1 (Current) | v2 (New) |
|-------|--------------|----------|
| Batch size | 10 neighborhoods | 3 neighborhoods |
| Alert method | SMTP email (fails silently) | Database logging to `pipeline_alerts` |
| Error handling | One failure crashes batch | Per-neighborhood try/catch |
| State persistence | End of batch only | After EACH neighborhood |
| API validation | None | Validates GEMINI/ANTHROPIC keys at startup |
| Tracking | Basic counters | Adds `neighborhoods_skipped`, `last_successful_neighborhood` |
| Rate limits | Claude 600ms, Census 200ms | Claude 400ms, Census 150ms |

**New API actions in v2:**

| Action | Description |
|--------|-------------|
| `{"action": "status"}` | Get current state + 10 recent alerts |
| `{"action": "reset"}` | Reset and start fresh from city 0 |
| `{"action": "stop"}` | Stop the pipeline gracefully |
| `{"action": "continue"}` | Continue processing (default) |
| `{"action": "watchdog"}` | Check for stall (>20 min no update) |
| `{"action": "alerts"}` | Get unacknowledged alerts only |
| `{"action": "acknowledge-alerts"}` | Mark all alerts as read |

**v2 Code Source:** The code from `populate-ca-neighborhoods-v2_2.ts` that you uploaded.

**Note:** The document parser failed to extract the TypeScript code from your upload. I will need you to either:
- Re-upload the `.ts` file directly (not wrapped in markdown), OR
- Paste the v2 code in chat, OR
- Confirm I should use the improvements described above and write the v2 code myself based on the existing v1 structure

---

## Step 3: Reset Stalled Pipeline State

**Type:** SQL update (via Supabase insert tool)

**SQL:**
```sql
UPDATE cron_state 
SET 
  status = 'stopped',
  is_running = false,
  message = '{"status": "stopped", "error_message": "Manually reset for v2 deployment"}',
  updated_at = NOW()
WHERE job_name = 'ca_neighborhood_population';
```

**Purpose:** Clear the stuck state so v2 can start fresh.

---

## Step 4: Restart Pipeline

**Type:** API call to edge function

**Command:**
```bash
curl -X POST "https://bgdtekbhelormzbymkhh.supabase.co/functions/v1/populate-ca-neighborhoods" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [ANON_KEY]" \
  -d '{"action": "reset"}'
```

**Expected response:**
```json
{
  "success": true,
  "message": "Pipeline reset and started",
  "result": {
    "done": false,
    "message": "Processed 3 neighborhoods in Adelanto. Progress: 0/1591 cities, 3 neighborhoods"
  }
}
```

---

## Implementation Order

| Step | Action | Type |
|------|--------|------|
| 1 | Create `pipeline_alerts` table | Database migration |
| 2 | Replace `populate-ca-neighborhoods/index.ts` with v2 | File modification |
| 3 | Deploy edge function | Automatic |
| 4 | Reset pipeline state | SQL update |
| 5 | Restart pipeline with `{"action": "reset"}` | API call |

---

## Files Summary

### Database Changes
| Change | Details |
|--------|---------|
| Create table | `pipeline_alerts` with 2 indexes |

### Files to Modify
| File | Change |
|------|--------|
| `supabase/functions/populate-ca-neighborhoods/index.ts` | Replace with v2 code (~970 lines) |

### NO Files to Delete
None. We are not deleting any edge functions or frontend files.

---

## Verification After Implementation

1. Pipeline starts with `{"action": "reset"}` and returns success
2. Status endpoint returns new state structure with `neighborhoods_skipped`
3. Alerts are written to `pipeline_alerts` table (check with SQL query)
4. Each neighborhood triggers state save (monitor `cron_state.updated_at`)
5. Pipeline continues past Antelope without stalling

---

## Blocker: v2 Code File

The file `populate-ca-neighborhoods-v2_2.ts` failed to parse. I need the actual TypeScript code to proceed.

**Options:**
1. Re-upload the raw `.ts` file
2. Paste the v2 code directly in chat
3. Tell me to write v2 myself based on the improvements listed above

