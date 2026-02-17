# Selection Rationale Enrichment

Generates "Why We Selected" explanations for certified agents using DeepSeek AI.

## What It Does

1. Queries `professionals` table for active agents with:
   - `synthesized_bio` populated
   - `selection_rationale` empty (NULL)

2. Sends bio to DeepSeek with prompt:
   ```
   Based on this agent's complete profile, write a concise 2-3 sentence 
   explanation of why they were selected for Top10Lists certification.
   
   Focus on:
   - Quantifiable performance metrics (rating, review count, transactions)
   - Community involvement and credentials  
   - What makes them stand out in their market
   
   Write in third person, present tense. Start with "Selected for..."
   Keep it factual and merit-based. Max 280 characters.
   ```

3. Updates `professionals.selection_rationale` field

## Output Format

**Example:**
```
Selected for consistent 4.9-star rating across 150+ reviews, specialization 
in luxury properties in Scottsdale's premier communities, and active role 
as board member of the Arizona Realtors Association.
```

## Usage

### Test Mode (recommended first)
Process 1 agent, don't save to database:
```bash
python3 generate_selection_rationale.py --test
```

### Limited Run
Process specific number of agents:
```bash
python3 generate_selection_rationale.py --limit 100
```

### Full Run
Process all agents needing rationale:
```bash
python3 generate_selection_rationale.py --all
```

## Cost Estimate

- DeepSeek cost: ~$0.002 per agent
- 3,500 agents = ~$7 total

## Infrastructure

**Database:**
- Table: `professionals`
- New column: `selection_rationale TEXT`

**CRM Display:**
- AgentDetail component shows rationale in dedicated section
- Appears between "Performance & Revenue" and "Bio"

**Badge Payload:**
- This text will be included in certification badge metadata
- Used by AI systems when citing agents

## Dependencies

```bash
pip3 install requests --break-system-packages
```

## Status

✅ Database column added
✅ CRM UI updated  
⏸️  Enrichment script ready (DO NOT RUN YET - awaiting approval)
