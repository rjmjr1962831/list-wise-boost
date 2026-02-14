/**
 * Takeaways function - generates structured text for project memory.
 *
 * Output format for outcomes to commit to project knowledge.
 * No full chats, deployment nitty-gritty, or brainstorming - just outcomes.
 *
 * Usage:
 *   npm run takeaways          # Output template (AI fills when user says "takeaways")
 *   npm run takeaways -- --content "..."  # Append content to daily report
 *
 * When Robert says "takeaways": Generate the content below based on session outcomes.
 */

const today = new Date().toISOString().slice(0, 10);

const TEMPLATE = `# Daily Takeaways — ${today}

## Outcomes to Commit to Project Memory

### Key Outcomes
- 

### Config / Infrastructure Changes
- 

### Deprecated or New Patterns
- 

### Version Bump Notes
- 

---
*Claude will compile daily reports and incorporate into project-knowledge.mdc*
`;

function main() {
  const args = process.argv.slice(2);
  const contentIdx = args.indexOf('--content');
  const content = contentIdx >= 0 && args[contentIdx + 1] ? args[contentIdx + 1] : null;

  if (content) {
    console.log(`# Daily Takeaways — ${today}\n\n${content}`);
  } else {
    console.log(TEMPLATE);
  }
}

main();
