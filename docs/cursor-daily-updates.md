# Cursor Daily Updates

## 2026-02-18

**Rule (Robert):** Do everything you can yourself. Only ask Robert for help on things he has to do himself (e.g. set secrets, run production DB migrations if policy forbids the assistant, paste API keys).

**HARD RULE: Git Branch Workflow.** NEVER merge main into staging. Staging is always the leading branch. New code goes to staging first. Main is production and only receives code when Robert explicitly tells Cursor to push staging to main. Staging contains internal documents, admin features, and in-progress work that must never be overwritten by main. If you need to add code, check out staging and commit directly to it. Do not attempt to "sync" or "update" staging from main under any circumstances.


## 2026-02-16

**Fix #5 – Custom instructions / system prompt (Pricing Model):** When updating the project's custom instructions (e.g. enrichment API docs or .cursor rules), replace any Pricing Model section that references `$39/$69/$99` neighborhood pricing (Main/Prime/Luxury) with the certification-tier pricing:
- **Listed:** $0 (basic verification, no badge)
- **Certified:** $0 (agent-verified, Standard Badge)
- **Audited:** $50/mo (monthly diligence, Enhanced AI Payload)
- **Underwritten:** $150/mo (real-time refresh, Maximum AI Reasoning)
- Pricing data stored in certification tier configuration

## 2025-02-10

**Rule for all AIs:** Run all commands independently. Execute every command you can in the terminal yourself. Do not ask Robert to run local commands for you.
