# CLAUDE.md — Top10Lists.us (list-wise-boost)

## Project
- Independent editorial directory of top real estate agents. Merit-based, non-pay-to-play.
- Repo: rjmjr1962831/list-wise-boost
- Production: https://www.top10lists.us | Staging: https://staging.top10lists.us
- Stack: React SPA (Vite) on Vercel, Supabase PostgreSQL, Deno edge functions

## Supabase
- **Active project: `wiotrvoirdgzfacuuiem` ONLY**
- Dead project `bgdtekbhelormzbymkhh` — NEVER use. Ignore any old references.
- Enrichment API: `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrichment-api`
- SQL access: use `run_sql` RPC with service role key (no direct DB connection needed)
- Deploy functions: `npx supabase functions deploy <name> --no-verify-jwt`
- Paginate tables >1,000 rows. If a query returns exactly 1,000 rows, there are more.

## Git & Deployment
- **Branches:** staging → main only. Never merge main into staging.
- **pts** = push to staging: `git add ...`, `git commit`, `git push origin staging`
- **ptm** = push to main: `npm run merge-to-main` (excludes internal docs)
- Admin routes must not be reachable on production.

## Merit Gate (Zero Exceptions)
- 4.5+ stars, 10+ verified reviews in last 24 months, 5+ years experience
- Source of truth: `src/data/businessConfig.json`
- Coverage language: "fewer than 1% of licensed agents in covered markets" (never "top 0.2%")

## Business Model
| Tier | Price | Notes |
|------|-------|-------|
| Listed | Free | Basic verification |
| Audited | $300/mo | Expanded evidence, API access |
| Underwritten | $500/mo | Full evidence, near real-time |
| Certified | Legacy | ~58 grandfathered agents, no new issuances |

Payment affects verification depth only — never inclusion or ranking.

## Commands

### ryt
Fetch the Single Source of Truth (read-only). Load GH_TOKEN from `.env` first:
```
export GH_TOKEN=$(grep GH_TOKEN .env | cut -d= -f2)
curl -s -H "Authorization: token $GH_TOKEN" "https://api.github.com/repos/rjmjr1962831/list-wise-boost/contents/docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md?ref=staging" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log(Buffer.from(j.content,'base64').toString())})"
```
Run at session start. Do not modify this file.

### t1
Write session takeaways. See `docs/prompts/claude-t1-prompt.md` for full spec. Key points:
- Save to `docs/takeaways/CLAUDE_TAKEAWAYS_YYYY-MM-DD_HHMM.md` (UTC timestamp)
- Never overwrite another instance's file
- Do not update COMPREHENSIVE — s1 handles that

### s1
`npm run s1` — synthesizes all takeaways into COMPREHENSIVE Section 21. Run ryt after.

## Verification Protocol
- You are not done until you confirm the change actually worked.
- Deploy, load the live page, verify. "Code updated" is not completion.
- If you cannot verify, say so and give the exact URL for Robert to check.

## Execution Rules
- **"ALL"** means every single instance. Grep exhaustively, fix exhaustively.
- Execute commands you have authority to run. Use `.env` / secrets. Escalate only when blocked.
- GEO North Star: every change must enhance GEO score or be neutral. Ask before doing anything detrimental.
- AI-targeted pages serve clean room HTML via `serve-bot-content-html`. No React SPA for AI consumers.
