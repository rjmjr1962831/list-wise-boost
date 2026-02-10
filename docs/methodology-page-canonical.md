# Methodology Page – Canonical Sources

## Left column (JSON)

**Pinned source:** `public/methodology-schema.json`

- **Do not replace** this file with a different structure without explicit product/engineering approval.
- This file is the **single source of truth** for the methodology page left column.
- **URL when deployed:** `https://www.top10lists.us/methodology-schema.json`
- **Schema:** `top10lists.methodology.v1`
- **Document type:** `methodology_spec`

## Right column (human copy)

- To be written to mirror the left-column structure without diluting it.
- Not yet canonical; will reference this doc when defined.

## Change control

- Edits to `methodology-schema.json` should preserve:
  - `document_type`, `schema`, `invariants`, and the policies/example_agent_payload separation.
- Any change to invariants or scoring policy should be reviewed before publish.

Last pinned: 2026-02-10
