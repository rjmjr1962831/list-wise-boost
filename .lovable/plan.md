
# Plan: "Think You Belong Here?" Neighborhood Expert Application Flow

## Overview

Add a CTA link on the neighborhood expert page that allows agents to apply for the featured position. The system will route them differently based on whether they already have an account (detected via persistent `localStorage` session token) or not.

---

## Current State Analysis

### Existing Identification Mechanisms
- **`agent_session_token`** in `localStorage`: Set when an agent completes email verification. Used to auto-login to dashboard.
- **`verification_token`** in URL: Used in magic links (`/profile/:token`) to identify agents.
- **`visibility_professional_id`** / **`visibility_professional_token`** in `sessionStorage`: Set during dashboard-to-funnel transitions.

### Existing Pages
- **`/profile/:token`** (FunnelStep0): Entry for invited agents via magic link
- **`/are-you-an-agent`**: Entry for unknown agents to submit Zillow URL
- **`/visibility/coverage`**: City selection step in visibility funnel
- **`/profile/:token/select-neighborhoods`**: Neighborhood selection for token-authenticated agents

---

## Proposed User Flow

```text
User clicks "Think you belong here? Click here" on neighborhood page
                          │
                          ▼
              Check localStorage for 
              'agent_session_token'
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
    Token EXISTS                    No Token
          │                               │
          ▼                               ▼
Validate token via               NEW PAGE: 
'validate-agent-session'         /neighborhood/apply
          │                               │
    ┌─────┴─────┐                        │
    ▼           ▼                        ▼
  VALID     INVALID               Email entry form
    │           │                        │
    │           ▼                        ▼
    │    Clear token,            Check email in
    │    go to email             'professionals' table
    │    entry page                      │
    ▼                        ┌───────────┴───────────┐
Navigate to                  ▼                       ▼
/profile/{token}        On the list            NOT on list
/select-neighborhoods    (active=true)         or inactive
(pre-select current              │                   │
 neighborhood)                   ▼                   ▼
                         Check funnel_events    Redirect to
                         for step0_completed    /are-you-an-agent
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
           Never started              Previously started
           the funnel                 (step0_completed)
                    │                         │
                    ▼                         ▼
         Redirect to            Redirect to
         /profile/{token}       /profile/{token}/review
         (Step 0)               (Accuracy Review)
```

---

## Implementation Steps

### Step 1: Add CTA to NeighborhoodExpertPage

Add a "Think you belong here? Click here" link inside the empty experts section and below the expert list when experts exist.

**File:** `src/components/NeighborhoodExpertPage.tsx`

**Changes:**
- Add a new link after the "This featured position is available" text
- Pass the current neighborhood context (state, city, ZIP, neighborhood slug) as query params so the application page knows which neighborhood the agent is interested in

**Example CTA placement:**
```
No Neighborhood Expert designated yet for [Neighborhood].
This featured position is available for agents with proven expertise in this area.

→ Think you belong here? Click here
```

---

### Step 2: Create New Page - NeighborhoodApply

**File:** `src/pages/NeighborhoodApply.tsx` (new file)

**Purpose:** Entry point for agents clicking the CTA from neighborhood pages

**Logic:**
1. On mount, check `localStorage.getItem('agent_session_token')`
2. **If token exists:**
   - Call `validate-agent-session` edge function
   - If valid: Fetch professional's `verification_token`, navigate to `/profile/{verification_token}/select-neighborhoods?preselect={neighborhoodSlug}`
   - If invalid: Clear token, show email form
3. **If no token:**
   - Show email entry form

**Email Form Logic:**
1. User enters email
2. Query `professionals` table:
   - `SELECT id, name, verification_token, active FROM professionals WHERE email = [input] LIMIT 1`
3. **If found AND active = true:**
   - Check `funnel_events` for `step0_completed` with that professional_id
   - If no event: Navigate to `/profile/{verification_token}` (Step 0)
   - If event exists: Navigate to `/profile/{verification_token}/review`
4. **If not found OR active = false:**
   - Navigate to `/are-you-an-agent` with a toast message explaining they need to qualify first

**UI Elements:**
- Current neighborhood context displayed (e.g., "Apply for Greenbriar, Glendale")
- Email input field
- Submit button
- Loading states
- Error handling

---

### Step 3: Add Route to App.tsx

**File:** `src/App.tsx`

**Add route:**
```typescript
<Route path="/neighborhood/apply" element={<NeighborhoodApply />} />
```

---

### Step 4: Modify SelectNeighborhoods for Pre-selection

**File:** `src/pages/profile/SelectNeighborhoods.tsx`

**Changes:**
- Read `preselect` query param on mount
- If `preselect` is provided, auto-select that neighborhood as the free neighborhood
- Show a highlighted message: "You're applying for [Neighborhood Name]"

---

### Step 5: Edge Function Enhancement (Optional)

Consider creating a lightweight edge function `check-agent-by-email` that:
- Queries professionals by email
- Returns: `{ exists: boolean, active: boolean, verification_token?: string, hasStartedFunnel?: boolean }`

This keeps email-to-token mapping server-side rather than exposing it client-side.

---

## Technical Details

### Query Params for Context
The CTA link will include:
```
/neighborhood/apply?state=arizona&city=glendale&zip=85304&neighborhood=greenbriar
```

### Session Token Validation
Reuse the existing `validate-agent-session` edge function which returns:
```json
{ "valid": boolean, "professional": { "id": string, "email": string, ... } }
```

### Funnel Event Check
Query to determine if agent has started funnel:
```sql
SELECT id FROM funnel_events 
WHERE professional_id = [id] 
AND event_name = 'step0_completed' 
LIMIT 1
```

---

## Security Considerations

1. **Email enumeration:** The page should not reveal whether an email exists in the system in a way that's exploitable. Consider rate limiting.
2. **Token exposure:** The `verification_token` is already used in URLs and is a UUID valid until 2099, so this is consistent with existing patterns.
3. **RLS:** Ensure the professionals query is properly scoped.

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/NeighborhoodExpertPage.tsx` | Modify: Add CTA link |
| `src/pages/NeighborhoodApply.tsx` | Create: New application entry page |
| `src/App.tsx` | Modify: Add route for /neighborhood/apply |
| `src/pages/profile/SelectNeighborhoods.tsx` | Modify: Add preselect param handling |
| (Optional) `supabase/functions/check-agent-by-email` | Create: Server-side email lookup |

---

## Testing Checklist

- [ ] Agent with valid session token gets redirected to neighborhood selection
- [ ] Agent with invalid/expired session token sees email form
- [ ] Agent with no session sees email form
- [ ] Email found + active + never started funnel → Step 0
- [ ] Email found + active + started funnel → Accuracy Review
- [ ] Email not found → /are-you-an-agent with explanation
- [ ] Email found + inactive → /are-you-an-agent with explanation
- [ ] Neighborhood context preserved through the flow
- [ ] Mobile responsive
- [ ] No console errors

