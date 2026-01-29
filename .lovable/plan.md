

# Fix Plan: Restore Agent Bios and Fix Card Layout

## What Went Wrong

I broke the agent cards by not understanding the data flow. Here is the precise issue:

**Database Fields:**
- `get_to_know_me` - Original Zillow "Get to Know Me" bio (HAS DATA)
- `description` - Original Zillow bio/description (MAY HAVE DATA)  
- `synthesized_bio` - AI-generated bio (HAS DATA)

**What `useAreaAgents.ts` Currently Does:**
- Fetches `synthesized_bio` only
- Maps it to `description` for the Professional type
- Does NOT fetch `get_to_know_me`
- Does NOT provide `original_description`

**What `ProfessionalCard.tsx` Expects:**
- Checks `(professional as any).get_to_know_me` for the bio button
- Falls back to `(professional as any).original_description`
- If BOTH are missing, the bio button returns `null`

**Result:** Grid is `grid-cols-3` but only 2 buttons render, causing the broken layout.

---

## The Fix (2 Changes)

### Change 1: Update `useAreaAgents.ts` Data Fetching

Add missing fields to BOTH SELECT queries (main query and fallback query):

```text
Current:  synthesized_bio
Add:      get_to_know_me, description
```

### Change 2: Update `useAreaAgents.ts` Mapping

Map the new fields to what `ProfessionalCard` expects:

```typescript
// In both mapping blocks (fallback and main)
get_to_know_me: prof.get_to_know_me || undefined,
original_description: prof.description || undefined,  // Map description to original_description
synthesized_bio: prof.synthesized_bio || undefined,
```

This ensures:
- The bio button gets `get_to_know_me` data (if available)
- Falls back to `original_description` (mapped from `description`)
- The grid layout works correctly (3 buttons when bio exists)

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useAreaAgents.ts` | Add `get_to_know_me`, `description` to SELECT; map to `get_to_know_me`, `original_description` |

---

## Technical Details

**Lines to modify in `useAreaAgents.ts`:**

1. **Fallback SELECT query (lines 182-206):** Add `get_to_know_me, description` fields
2. **Fallback mapping (lines 236-268):** Add the three bio field mappings
3. **Main SELECT query (lines 280-303):** Add `get_to_know_me, description` fields
4. **Main mapping (lines 317-351):** Add the three bio field mappings

---

## Verification Plan

After implementation:
1. Navigate to /arizona/phoenix/85018/arcadia/top10realestateagents
2. Verify agent cards show 3 buttons (From [Name], Reviews, News and Awards)
3. Click "From [Name]" button and verify bio content displays
4. Verify buttons are evenly spaced, not mashed together
5. Run 5-page test per project rules

