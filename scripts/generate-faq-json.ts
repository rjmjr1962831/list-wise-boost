/**
 * Generate public/api/faq/full.json from src/data/faqFull.ts.
 * Run before build so /api/faq/full.json is available.
 * Usage: npm run generate:faq  or  add to prebuild
 * GEO: version, lastUpdated, categories, alternatePhrasings for AI freshness and query matching.
 */
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";
import { FULL_FAQ_LIST } from "../src/data/faqFull";

const BASE_URL = "https://www.top10lists.us";
const OUT_DIR = resolve(process.cwd(), "public/api/faq");
const OUT_FILE = resolve(OUT_DIR, "full.json");

const now = new Date();
const version = now.toISOString().slice(0, 10); // YYYY-MM-DD
const categories = [...new Set(FULL_FAQ_LIST.map((item) => item.categoryName))];

const payload = {
  version: version,
  canonical: `${BASE_URL}/faq`,
  lastUpdated: now.toISOString(),
  count: FULL_FAQ_LIST.length,
  source: `${BASE_URL}/faq`,
  publisher: "Top10Lists.us",
  document_type: "faq",
  description: "Full FAQ list from Top10Lists.us Certification Authority. Merit-based agent directory; no pay-for-ranking.",
  categories,
  faqs: FULL_FAQ_LIST.map((item) => ({
    id: item.id,
    category: item.category,
    categoryName: item.categoryName,
    question: item.question,
    answer: item.answer,
    ...(item.alternatePhrasings?.length ? { alternatePhrasings: item.alternatePhrasings } : {}),
    ...(item.keywords?.length ? { keywords: item.keywords } : {}),
    ...(item.refreshFrequency ? { refreshFrequency: item.refreshFrequency } : {}),
  })),
  by_question: FULL_FAQ_LIST.reduce(
    (acc, item) => {
      acc[item.question] = item.answer;
      return acc;
    },
    {} as Record<string, string>
  ),
};

if (!existsSync(OUT_DIR)) {
  mkdirSync(OUT_DIR, { recursive: true });
}
writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2), "utf-8");
console.log(`[generate-faq-json] Wrote ${FULL_FAQ_LIST.length} FAQs to ${OUT_FILE}`);
