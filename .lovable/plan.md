
# Plan: DeepSeek California Neighborhood Discovery Test

## Objective
Create an edge function that uses DeepSeek to discover neighborhoods and their corresponding cities for 3 California test cities. This will evaluate whether DeepSeek can replace Gemini Flash 2.5 for the neighborhood discovery step (cheaper alternative).

## Test Cities (Suggested)
I recommend testing with cities of different sizes to evaluate DeepSeek's knowledge:
1. **San Diego** - Large city with well-known neighborhoods (La Jolla, Pacific Beach, Gaslamp, etc.)
2. **Oakland** - Mid-size city with distinct neighborhoods (Rockridge, Temescal, Jack London, etc.)
3. **Anaheim** - Smaller city, fewer distinct neighborhoods (tests accuracy on sparse data)

## Implementation

### New Edge Function: `discover-neighborhoods-deepseek`

**Location:** `supabase/functions/discover-neighborhoods-deepseek/index.ts`

**Core Logic:**
1. Accept a list of city names (or use hardcoded test cities)
2. For each city, call DeepSeek with a neighborhood discovery prompt
3. Return structured JSON with neighborhoods and their cities

### DeepSeek Prompt Design
```text
You are a California real estate expert. List all distinct, locally-recognized 
neighborhoods in {cityName}, California.

For each neighborhood provide:
- name: Official or commonly used name
- slug: URL-safe lowercase-hyphenated version
- city: The city this neighborhood belongs to
- zipCodes: Array of ZIP codes covering this neighborhood
- primaryZip: Main ZIP code
- description: 1-2 sentence description
- vibe: One phrase describing neighborhood character

Return ONLY valid JSON array. For small cities with no distinct neighborhoods, return [].
```

### Response Format
```json
{
  "city": "San Diego",
  "neighborhoods": [
    {
      "name": "La Jolla",
      "slug": "la-jolla", 
      "city": "San Diego",
      "zipCodes": ["92037", "92038"],
      "primaryZip": "92037",
      "description": "Upscale coastal community known for beaches and UC San Diego.",
      "vibe": "Affluent seaside resort"
    }
  ],
  "model": "deepseek-chat",
  "processingTimeMs": 1234
}
```

## Technical Details

### API Configuration
- **Model:** `deepseek-chat` (cost-effective, good for structured output)
- **Temperature:** 0.2 (low for factual accuracy)
- **Max Tokens:** 8192 (neighborhoods can be verbose)
- **API Key:** `DEEPSEEK_API_KEY` (already configured in secrets)

### Function Structure
```typescript
// 1. CORS headers (standard pattern)
// 2. Accept POST with { cities: ["San Diego", "Oakland", "Anaheim"] }
// 3. For each city:
//    a. Fetch lat/lon from cities table
//    b. Call DeepSeek with neighborhood discovery prompt
//    c. Parse JSON response
// 4. Return combined results with timing metrics
```

### Comparison Metrics
The function will capture:
- Processing time per city
- Number of neighborhoods discovered
- Token usage (if available in response)

This allows direct comparison with the existing Gemini Flash implementation.

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/discover-neighborhoods-deepseek/index.ts` | Main edge function |

## Files to Modify

| File | Change |
|------|--------|
| `supabase/config.toml` | Add function entry (if needed) |

## Testing Plan
1. Deploy the edge function
2. Call with test cities: `{ "cities": ["San Diego", "Oakland", "Anaheim"] }`
3. Evaluate results for:
   - Accuracy of neighborhood names
   - Correct ZIP code assignments
   - Quality of descriptions
   - Processing time vs Gemini Flash

## Expected Output
A comparison showing:
- DeepSeek neighborhoods discovered per city
- Quality assessment (known neighborhoods included/missed)
- Cost/speed comparison with current Gemini pipeline

## Next Steps After Testing
If DeepSeek performs well:
1. Add it as an option in the main `populate-ca-neighborhoods` function
2. Use the two-model approach: DeepSeek for discovery → Sonnet for polish
3. Run full California enrichment with the cheaper pipeline
