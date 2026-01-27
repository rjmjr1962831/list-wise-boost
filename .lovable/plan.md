

## Un-Pin All Brand Builders Except Beauvais in Scottsdale

### Summary
Remove all `is_brand_builder` pinning except for Dina and Mark Beauvais in Scottsdale. This ensures fair round-robin rotation for all other agents across all cities.

---

### Database Changes

**Update 6 agents to remove brand builder status:**

| Agent | City | Action |
|-------|------|--------|
| Eileen Taggart | Flagstaff | Set `is_brand_builder = false` |
| Claire Ackerman | Scottsdale | Set `is_brand_builder = false` |
| Eric Tont | Scottsdale | Set `is_brand_builder = false` |
| Jeff Seman | Phoenix | Set `is_brand_builder = false` |
| Robert Maynard | Avondale | Set `is_brand_builder = false` |
| Adam Hamblen | Avondale | Set `is_brand_builder = false` |
| Cody Anne Yarnes | Prescott | Set `is_brand_builder = false` |

**Beauvais stays pinned:**
- Dina And Mark Beauvais (Scottsdale) - remains `is_brand_builder = true`

---

### Code Changes

**File: `src/pages/DynamicCategoryList.tsx`**

1. **Remove Phoenix from Beauvais pinning logic** (lines 512-523)
   - Currently pins Beauvais to #1 in both Scottsdale AND Phoenix
   - Change to pin ONLY in Scottsdale

2. **Update stub injection logic** (lines 419-464)
   - Already Scottsdale-only, no change needed

---

### Technical Details

**SQL Migration:**
```sql
UPDATE professionals 
SET is_brand_builder = false 
WHERE is_brand_builder = true 
  AND id NOT IN ('bf553bf9-6d6c-4b54-8bd4-3699332c8287'); -- Beauvais ID
```

**Code change in DynamicCategoryList.tsx:**
```typescript
// Before (line 512):
if ((cityData.slug === 'scottsdale' || cityData.slug === 'phoenix') && ...)

// After:
if (cityData.slug === 'scottsdale' && ...)
```

---

### Result After Implementation

- **Scottsdale**: Beauvais always #1, remaining 9 slots rotate hourly among qualified agents
- **Phoenix**: All 10 slots rotate hourly (no pinned agents)
- **Flagstaff**: All 10 slots rotate hourly (Eileen Taggart joins rotation)
- **All other cities**: All 10 slots rotate hourly (no pinned agents)

---

### Verification Steps

1. Query database to confirm only Beauvais has `is_brand_builder = true`
2. Test Scottsdale page - Beauvais should appear #1
3. Test Phoenix page - no pinned agent, rotation only
4. Test Flagstaff page - Eileen Taggart in rotation, not pinned

