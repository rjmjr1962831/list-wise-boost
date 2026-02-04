# Coding Patterns & Common Mistakes

## 🚨 Critical Patterns

### 1. UI Links - Always Include Copy Button
**Rule:** Every link/URL shown to users must have a copy button

**Component:** Use `CopyableLink` component
```typescript
import { CopyableLink } from '@/components/ui/copyable-link';

<CopyableLink 
  url="https://example.com/path"
  label="Optional label"
  showOpenButton={true} // Optional: adds "Open" button
/>
```

**Examples:**
- Admin testing tools (funnel URLs, tokens)
- Agent verification links
- Profile URLs
- API endpoints
- Any shareable links

**Why:** Improves UX - users can quickly copy/share links without manual selection

📖 Component: `src/components/ui/copyable-link.tsx`

### 2. Supabase Pagination
**Problem:** Supabase defaults to 1,000 rows. Queries without pagination only return first 1,000 results.

**Solution:** Always paginate for large datasets
```typescript
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
  if (data.length < pageSize) break;
  offset += pageSize;
}
```

**Large tables requiring pagination:**
- `professionals` (~4,500+ rows)
- `neighborhood_catalog` (~2,000+ rows)
- Growing tables: `funnel_analytics`, `agent_neighborhood_subscriptions`

📖 Full docs: `.cursor/rules/supabase-pagination.md`

### 3. Database Content Formatting
**Pattern:** Always format plain text content with paragraph breaks before saving

**Files:**
- Frontend/Scripts: `src/utils/formatParagraphs.ts`
- Edge Functions: `supabase/functions/_shared/formatParagraphs.ts`

**Usage:**
```typescript
import { formatWithParagraphs } from '@/utils/formatParagraphs';
const formatted = formatWithParagraphs(plainText);
```

**Applied to:**
- `professionals.synthesized_bio`
- `neighborhood_catalog.writeup_html`

📖 Full docs: `docs/paragraph-formatting.md`

### 4. Background Jobs
**Pattern:** Long-running operations (> 120s) automatically background

**How it works:**
- Set `block_until_ms` appropriately
- Job moves to background if timeout exceeded
- Monitor via terminal file in `terminals/` folder
- Poll with `Read` tool to check progress

**Example:**
```typescript
// Scripts that process 1,000+ records
await shell('npm run format-bios', { block_until_ms: 180000 });
```

## 📋 Pre-Deploy Checklist

Before deploying new features:

- [ ] Paginate all Supabase queries on large tables
- [ ] Apply paragraph formatting to user-generated content
- [ ] Add analytics tracking for user actions
- [ ] Test with real account (use admin funnel testing tool)
- [ ] Run linting: `ReadLints` tool
- [ ] Audit data quality (nearby neighborhoods, etc.)

## 🛠️ Admin Testing Tools

Location: `/admin` dashboard

- **Funnel Test** - Test onboarding flows with real accounts
- **Nearby Neighborhoods Audit** - Check for data quality issues
- **Analytics Dashboard** - View conversion events

## 📚 Documentation

- `.cursor/rules/` - AI assistant rules and patterns
- `docs/` - Detailed documentation
- `scripts/README.md` - Script documentation
- This file - Quick reference

## 🔍 Finding Things

**Search patterns:**
```bash
# Find Supabase queries
Grep: "\.from\(.*\)\.select"

# Find content formatting
Grep: "synthesized_bio|writeup_html"

# Find pagination
Grep: "\.range\(|pageSize"
```

## 💾 State Management

**Analytics:** Stored in `funnel_analytics` table
**Nearby Neighborhoods:** Stored as JSONB in `neighborhood_catalog.nearby_neighborhoods`
**Sessions:** Agent sessions use `localStorage.getItem('agent_session_token')`

## 🚀 Deployment

**Environments:**
- Staging: `staging.top10lists.us` (staging branch)
- Production: `list-wise-boost.vercel.app` (main branch)

**Vercel Setup:**
- Staging domain → Preview (staging branch)
- Production domain → Production (main branch)
