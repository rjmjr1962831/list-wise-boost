# Scripts

## format-agent-bios.ts

Adds proper paragraph formatting to all agent `synthesized_bio` fields in the database.

### What it does

- Fetches all professionals with a `synthesized_bio`
- Intelligently splits text into paragraphs based on:
  1. **First paragraph**: Track record, credentials, experience summary
  2. **Middle paragraphs**: Specialties, expertise, approach, methodologies
  3. **Final paragraph**: Community involvement, awards, charity work
- Wraps text in proper HTML `<p>` tags
- Updates the database with formatted content
- Skips bios that already have paragraph tags

### Usage

```bash
# Install dependencies first (if not already installed)
npm install

# Run the script
npm run format-bios
```

Or run directly:

```bash
npx tsx scripts/format-agent-bios.ts
```

### Safety Features

- Only processes records that have a `synthesized_bio`
- Skips records that already have `<p>` tags
- Provides detailed progress output
- Shows summary of updated/skipped/failed records

### Example Output

```
============================================================
AGENT BIO PARAGRAPH FORMATTER
============================================================

Fetching all professionals with synthesized_bio...
  Fetched 150 professionals...

Total professionals with bios: 150

Processing and updating bios...

Processing: Dina Beauvais (abc-123)
  Original length: 850 chars
  Formatted length: 920 chars
  ✓ Updated successfully

Processing: John Smith (def-456)
  Already has paragraph tags, skipping...

...

============================================================
SUMMARY
============================================================
Total processed: 150
Updated: 120
Skipped: 28
Errors: 2
============================================================
```
