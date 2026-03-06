import { readFileSync, writeFileSync } from 'fs';

const path = 'docs/GEO-audit-production-2026-03.md';
let s = readFileSync(path, 'utf8');

// Homepage table row (match flexible quote chars)
s = s.replace(/\| Homepage\s+\| ⚠️\s+\| Verify[^|]+\|/, '| Homepage          | ⚠️→✅  | Fix: root serves SPA. Verify after next deploy. |');

// Action bullet → Fix (match any quote)
s = s.replace(/- \*\*Action:\*\* If production still shows[^\n]+\./, '- **Fix:** Post-build no longer overwrites `index.html` with `_home.html`. Root (/) now serves the SPA (live Index.tsx). After next deploy, confirm at [homepage](https://www.top10lists.us/).');

// Priority list
s = s.replace(/1\. Confirm production homepage[^\n]+\./, '1. Deploy (pts → ptm) so homepage serves SPA; then confirm [homepage](https://www.top10lists.us/) shows softened copy.');
s = s.replace(/3\. Run Rich Results Test[^\n]+\./, '3. Rich Results: Robert handling.');
s = s.replace(/4\. \(Optional\) Add static[^\n]+\./, '4. ~~protocol-adopters~~ — done (clean-room HTML).');

// Insert re-audit section before Priority Actions
const reaudit = `

## Re-audit (post–protocol-adopters + homepage fix)

- **Homepage:** Was still showing old copy because production served static \`_home.html\`. Post-build now keeps \`index.html\` as SPA; next deploy will show Index.tsx copy.
- **protocol-adopters:** [protocol-adopters](https://www.top10lists.us/protocol-adopters) returns full clean-room HTML. ✅
- **ai-content-index:** Live JSON still has \`botRendering\`: Cloudflare; update to Supabase Edge when editing.

`;
s = s.replace(/(## Priority Actions)/, reaudit + '$1');

writeFileSync(path, s);
console.log('[patch-audit-doc] Updated GEO audit doc.');
