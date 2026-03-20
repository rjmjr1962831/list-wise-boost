# Automatic Paragraph Formatting System

## Overview

All content written to the database now automatically receives proper paragraph formatting. This ensures consistent, readable formatting across agent profiles, neighborhoods, and other content.

## What It Does

The system intelligently breaks plain text into paragraphs based on:

1. **First paragraph**: Track record, credentials, and experience summary (1-2 sentences)
2. **Middle paragraphs**: Specialties, expertise, approach, and methodologies (3-5 sentences)
3. **Final paragraph**: Community, awards, and charity work (remaining sentences)

### Features

- ✅ Automatically detects if content already has `<p>` tags and skips formatting
- ✅ Removes invalid HTML but preserves `<br>` tags
- ✅ Uses keyword detection to identify topic shifts
- ✅ Prevents overly long paragraphs (max 5 sentences)
- ✅ Handles short content gracefully (wraps 1-2 sentences in single paragraph)

## Where It's Applied

### 1. Professional Profiles (`synthesized_bio`)

**Locations:**
- `supabase/functions/generate-agent-bios/index.ts` - Short bio generation
- `supabase/functions/synthesize-agent-profile/index.ts` - Detailed profile synthesis
- All other edge functions that update `synthesized_bio`

**When:** Every time a new agent bio is generated or updated

### 2. Neighborhoods (`writeup_html`)

**Locations:**
- `supabase/functions/generate-neighborhood-writeup/index.ts` - Neighborhood writeup generation
- All other edge functions that update `writeup_html`

**When:** Every time a new neighborhood writeup is generated

### 3. Cities

**Status:** Cities table doesn't have description/bio fields. If added in the future, integrate the same formatting utility.

## Implementation Files

### Utility Functions

1. **React/Frontend:** `src/utils/formatParagraphs.ts`
   - For use in React components and Node.js scripts
   - Includes `formatWithParagraphs()` and `formatTextFields()` functions

2. **Deno/Edge Functions:** `supabase/functions/_shared/formatParagraphs.ts`
   - For use in Supabase edge functions
   - Deno-compatible version with same logic

### Key Functions

```typescript
// Format a single text field
const formatted = formatWithParagraphs(plainText);

// Format multiple fields in an object
const formatted = formatTextFields(object, ['field1', 'field2']);
```

## Historical Data

**One-time migration completed:** February 4, 2026

- Processed: 4,478 agent profiles
- Updated: 4,200 profiles
- Skipped: 278 profiles (already had paragraph tags)
- Errors: 0
- Time: ~15 minutes

**Script:** `scripts/format-agent-bios.ts`

Run with: `npm run format-bios` (only needed for bulk fixes, not regular operation)

## Adding to New Content Types

If you add new content fields that need paragraph formatting:

1. Import the utility:
   ```typescript
   // For Deno edge functions
   import { formatWithParagraphs } from '../_shared/formatParagraphs.ts';
   
   // For React/Node
   import { formatWithParagraphs } from '@/utils/formatParagraphs';
   ```

2. Apply before saving:
   ```typescript
   const formattedContent = formatWithParagraphs(rawContent) || rawContent;
   
   await supabase
     .from('table_name')
     .update({ content_field: formattedContent })
     .eq('id', id);
   ```

## Testing

The system is safe and non-destructive:
- Already-formatted content is detected and skipped
- Original content is preserved if formatting fails
- No data loss risk

## Future Enhancements

Possible improvements:
- AI-based topic detection for more intelligent paragraph breaks
- Configurable paragraph lengths
- Support for more complex HTML structures
- Markdown support
