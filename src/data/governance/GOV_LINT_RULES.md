# GOV Lint Rules
Goal: prevent unsafe copy and pricing errors from shipping.

## Required phrases (exact match)
These must appear where applicable.

### Neighborhood pages (required)
"This does not affect overall city ranking."

### Master instruction (required in prompts)
"Remember your knowledge – follow the project custom knowledge rules."

### Refund (required anywhere payment is discussed)
"If neighborhood expertise cannot be verified, refund the payment."
Alternative acceptable:
"If neighborhood expertise cannot be verified, payment is refunded."

## Forbidden patterns (denylist)
Fail build if any public-facing copy contains these phrases (case-insensitive):

- "get more leads"
- "lead generation"
- "boost visibility"
- "outrank"
- "rank higher"
- "pay to play"
- "guaranteed ranking"
- "increase ranking"
- "top spot"
- "buy your way"
- "featured because you paid"
- "sponsored ranking"
- "promoted ranking"

## Forbidden UI pattern
Fail build if pricing UI contains a separate "annual subscription" line item.
Suggested regex checks:
- /annual\s+subscription/i
- /annual\s+plan\s+line\s+item/i

## Em dash ban
Fail build if the em dash character is present:
- "—" (U+2014)
Suggested regex:
- /\u2014/

## Payment scope protection
If copy contains the word "guarantee", it must also contain:
- "within verified neighborhoods"
and
- "after approval"
Suggested check:
- if /guarantee/i then require both substrings on the same page.

## Ranking independence protection
If a page mentions payment, it must not contain:
- "rank" within 40 characters of "pay" or "payment"
Suggested heuristic regex:
- /pay.{0,40}rank|rank.{0,40}pay/i
