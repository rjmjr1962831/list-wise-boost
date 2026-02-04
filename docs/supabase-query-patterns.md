# Supabase Query Patterns & Best Practices

## Critical: Pagination Required for Large Datasets

**⚠️ IMPORTANT:** Supabase has a **default 1,000 row limit** on queries. This is NOT the total number of rows - it's an artificial limit that requires pagination.

### Always Paginate for Large Queries

```typescript
// ❌ BAD - Will only get 1,000 rows max
const { data } = await supabase
  .from('table_name')
  .select('*');

// ✅ GOOD - Paginate to get all rows
async function fetchAllRows() {
  const pageSize = 1000;
  let offset = 0;
  const allRows = [];
  
  while (true) {
    const { data, error } = await supabase
      .from('table_name')
      .select('*')
      .range(offset, offset + pageSize - 1);
    
    if (error) throw error;
    if (!data || data.length === 0) break;
    
    allRows.push(...data);
    
    if (data.length < pageSize) break; // Last page
    offset += pageSize;
  }
  
  return allRows;
}
```

## Common Use Cases

### 1. Counting Rows

```typescript
// Use count instead of fetching all rows
const { count, error } = await supabase
  .from('table_name')
  .select('*', { count: 'exact', head: true });
```

### 2. Processing Large Datasets in Batches

```typescript
async function processBatches(processFunc: (batch: any[]) => Promise<void>) {
  const pageSize = 1000;
  let offset = 0;
  
  while (true) {
    const { data, error } = await supabase
      .from('table_name')
      .select('*')
      .range(offset, offset + pageSize - 1);
    
    if (error) throw error;
    if (!data || data.length === 0) break;
    
    await processFunc(data);
    
    if (data.length < pageSize) break;
    offset += pageSize;
    
    // Optional: Add delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
```

### 3. Edge Function Pagination

In Deno edge functions, same pattern applies:

```typescript
// In edge function
async function getAllNeighborhoods() {
  const pageSize = 1000;
  let offset = 0;
  const all = [];
  
  while (true) {
    const { data } = await supabase
      .from('neighborhood_catalog')
      .select('*')
      .eq('is_active', true)
      .range(offset, offset + pageSize - 1);
    
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  
  return all;
}
```

## Performance Tips

1. **Use `.select()` with specific columns** instead of `*` when possible
2. **Add `.limit()` if you only need a subset**
3. **Use `.count()` for totals without fetching data**
4. **Add indexes** on frequently queried columns
5. **Use `.range()` for pagination** (more efficient than `.limit().offset()`)

## Edge Function Specific Notes

- Edge functions have timeout limits (~60 seconds default)
- For very large datasets, consider background jobs instead
- Use streaming responses for real-time progress updates

## Examples in This Codebase

- ✅ `scripts/format-agent-bios.ts` - Correctly paginates professionals
- ✅ `scripts/generate-static-sitemaps.ts` - Paginates cities and neighborhoods
- ❌ `scripts/fix-nearby-neighborhoods.ts` - **NEEDS FIX** - Only gets 1,000 neighborhoods

## When to Paginate

**Always paginate if:**
- Table has > 1,000 rows (or might grow to that)
- Running batch operations
- Auditing/analyzing data
- Exporting data

**Pagination not needed if:**
- Query has `.limit()` less than 1,000
- Using specific filters that guarantee < 1,000 results
- Counting only (`.count()`)
