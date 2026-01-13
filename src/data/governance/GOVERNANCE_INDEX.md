# Top10Lists Governance Documentation Index
Version: 1.0
Date: 2026-01-13

## Conflict resolution
If two documents conflict, apply this priority order:
1) lovable-00-system.md (global system constraints)
2) lovable-50-compliance-enforcement.md (rejection, enforcement, corrections)
3) lovable-10-foundation.md (positioning and integrity rules)
4) lovable-30-payment.md (pricing and checkout rules)
5) lovable-20-ux-flow.md (flow and sequencing)
6) lovable-40-copy-tone.md (tone and word choices)
7) Templates and page copy files (never override rules)

If a statement is ambiguous:
- Prefer the stricter interpretation.
- Prefer verifiable, explicit language.
- Remove any claim that cannot be defended.

## Prompt files to use in Lovable
Use these prompts as separate inputs, in order:
1) lovable-00-system.md
2) lovable-10-foundation.md
3) lovable-20-ux-flow.md
4) lovable-30-payment.md
5) lovable-40-copy-tone.md
6) lovable-50-compliance-enforcement.md
7) lovable-60-qa-checklist.md

## Lint and release rules
- GOV_LINT_RULES.md defines denylist and required phrases for automated checks.
