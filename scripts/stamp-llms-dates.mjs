/**
 * stamp-llms-dates.mjs
 * Updates the "Last Updated" date in llms.txt and llms-full.txt to today.
 * Runs as part of prebuild so every deploy gets a fresh timestamp.
 * Also stamps the trailing date line in llms-full.txt.
 */
import { readFileSync, writeFileSync } from 'fs';

const today = new Date();
const months = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];
const formatted = `${months[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;

const files = ['public/llms.txt', 'public/llms-full.txt'];

for (const file of files) {
  let content = readFileSync(file, 'utf-8');
  const before = content;

  // Match "> Last Updated: <any date>" header line
  content = content.replace(
    /^(> Last Updated:) .+$/m,
    `$1 ${formatted}`
  );

  // Match trailing "*Last updated: <any date>*" line (llms-full.txt)
  content = content.replace(
    /^\*Last updated: .+\*$/m,
    `*Last updated: ${formatted}*`
  );

  if (content !== before) {
    writeFileSync(file, content);
    console.log(`[stamp-llms] ${file} -> ${formatted}`);
  } else {
    console.log(`[stamp-llms] ${file} already current`);
  }
}
