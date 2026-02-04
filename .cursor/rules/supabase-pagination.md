# Supabase Pagination Rule

## CRITICAL: Always Paginate Large Queries

Supabase has a **1,000 row default limit**. This is NOT the total table size - it's an artificial query limit.

## When to Paginate

Paginate whenever:
- ✅ Querying tables with > 1,000 rows
- ✅ Running batch operations
- ✅ Auditing/analyzing data
- ✅ Exporting data
- ✅ Using `.from('table').select('*')`without `.limit()`

## Standard Pagination Pattern

```typescript
async function fetchAllRows<T>(query: any): Promise<T[]> {
  const pageSize = 1000;
  let offset = 0;
  const allRows: T[] = [];
  
  while (true) {
    const { data, error } = await query
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

## Usage

```typescript
// Build query
const query = supabase
  .from('neighborhood_catalog')
  .select('*')
  .eq('is_active', true);

// Fetch all with pagination
const allNeighborhoods = await fetchAllRows(query);
```

## Large Tables in This Project

- `professionals` - ~4,500+ rows ✅ PAGINATE
- `neighborhood_catalog` - ~2,000+ rows ✅ PAGINATE  
- `cities` - < 1,000 rows ⚠️ May grow
- `agent_neighborhood_subscriptions` - Growing ⚠️
- `funnel_analytics` - Growing ⚠️

## Reference

Full documentation: `docs/supabase-query-patterns.md`
