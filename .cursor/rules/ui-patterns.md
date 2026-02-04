# UI/UX Patterns

## Always Include Copy Button for Links

**Rule:** Every link or URL displayed to users MUST have a copy button.

### Use CopyableLink Component

```typescript
import { CopyableLink, CopyableText } from '@/components/ui/copyable-link';

// For URLs
<CopyableLink 
  url="https://staging.top10lists.us/profile/abc123/select-neighborhoods"
  label="Neighborhood Selection Link"
  showOpenButton={true}
/>

// Compact variant (smaller, inline)
<CopyableLink 
  url="https://example.com"
  variant="compact"
/>

// Inline variant (in text)
<p>Visit <CopyableLink url="https://example.com" variant="inline" /> for more info</p>

// For non-URL text (tokens, IDs)
<CopyableText 
  text="abc-123-def-456"
  label="Verification Token"
  masked={true} // Shows abc-123...ef-456
/>
```

### When to Use

✅ **Always use for:**
- Admin testing URLs
- Verification tokens
- Profile links
- API endpoints
- Shareable URLs
- Agent dashboard links
- Payment links
- Verification codes

❌ **Don't need for:**
- Navigation links (in menus, buttons)
- Internal routing links
- Form submit buttons

### Variants

1. **default** - Full card with label, good for admin tools
2. **compact** - Smaller, good for lists or tables
3. **inline** - For embedding in paragraphs

### Examples in Codebase

- `FunnelTestingTool.tsx` - Admin funnel testing links
- `AdminDashboard.tsx` - Quick action URLs
- Agent verification emails (should use this pattern)

### User Experience

- One-click copy (no need to select text)
- Toast confirmation on copy
- Optional "Open in new tab" button
- Consistent styling across app
- Mobile-friendly (buttons are tappable)

## Related Patterns

- **Toast notifications** - Always confirm copy action
- **External links** - Add `noopener,noreferrer` for security
- **Truncation** - Long URLs should truncate with `truncate` class
