# Dynamic Sitemap Setup

This project uses a hybrid approach for sitemap generation:

## 1. Static Sitemap (`public/sitemap.xml`)
- Located at: `https://top10lists.us/sitemap.xml`
- Manually updated when major structural changes occur
- Contains all 32 Arizona cities
- Includes major city API endpoints for AI discovery

## 2. Dynamic Sitemap (Edge Function)
- Located at: `https://bgdtekbhelormzbymkhh.supabase.co/functions/v1/generate-sitemap`
- Automatically updates based on database content
- Pulls all active cities and categories in real-time
- No manual updates needed

## How It Works

### Edge Function: `generate-sitemap`
The edge function (`supabase/functions/generate-sitemap/index.ts`):
1. Queries all active cities from the `cities` table
2. Queries all active categories from the `categories` table
3. Generates XML sitemap with all city + category combinations
4. Includes API discovery endpoints for major cities
5. Caches results for 1 hour

### robots.txt Configuration
Both sitemaps are declared in `public/robots.txt`:
```
Sitemap: https://top10lists.us/sitemap.xml
Sitemap: https://bgdtekbhelormzbymkhh.supabase.co/functions/v1/generate-sitemap
```

## When to Update

### Static Sitemap
Update `public/sitemap.xml` when:
- Adding new static pages (legal, info pages, etc.)
- Making major structural changes to the site
- Want to ensure critical pages are always listed

### Dynamic Sitemap
No updates needed! It automatically reflects:
- New cities added to the database
- New categories created
- Changes to active status of cities/categories

## SEO Benefits

1. **Always Current**: Dynamic sitemap ensures search engines see new cities immediately
2. **Comprehensive Coverage**: All city + category combinations are included
3. **AI Discovery**: API endpoints help LLMs find agent data
4. **Redundancy**: Static sitemap provides backup if edge function fails

## Testing

Test the dynamic sitemap:
```bash
curl https://bgdtekbhelormzbymkhh.supabase.co/functions/v1/generate-sitemap
```

## Performance

- **Cache**: 1 hour cache on edge function responses
- **Efficiency**: Single database query for cities and categories
- **Size**: Scales with database content (currently ~100 URLs)

## Future Enhancements

Potential improvements:
1. Add individual agent profile URLs for top-ranked agents
2. Create sitemap index for large city counts
3. Add lastmod dates for pages
4. Include image sitemaps for agent photos
