/**
 * Shared merge variable definitions for all email compose surfaces.
 * Single source of truth — used by MergeVariablePicker, ListMaker,
 * CampaignManager, ContactDetail, TasksManager, EmailManager.
 */

export interface MergeVariable {
  key: string;
  label: string;
  category: string;
  /** If this variable is a URL, wrap it in an <a> tag with this link text */
  linkText?: string;
}

export const MERGE_VARIABLES: MergeVariable[] = [
  // ── Contact ──
  { key: "first_name", label: "First Name", category: "Contact" },
  { key: "name", label: "Full Name", category: "Contact" },
  { key: "last_name", label: "Last Name", category: "Contact" },
  { key: "email", label: "Email", category: "Contact" },
  { key: "phone", label: "Phone", category: "Contact" },
  { key: "website", label: "Website", category: "Contact", linkText: "their website" },
  { key: "social_linkedin", label: "LinkedIn URL", category: "Contact", linkText: "their LinkedIn" },
  { key: "company", label: "Company / Brokerage", category: "Contact" },

  // ── Profile ──
  { key: "current_tier", label: "Current Tier", category: "Profile" },
  { key: "city_name", label: "City", category: "Profile" },
  { key: "state_slug", label: "State", category: "Profile" },
  { key: "canonical_slug", label: "Canonical Slug", category: "Profile" },
  { key: "magic_link", label: "Dashboard Link", category: "Profile", linkText: "your dashboard" },
  { key: "zillow_profile_url", label: "Zillow URL", category: "Profile", linkText: "your Zillow profile" },

  // ── Dates ──
  { key: "date_first_listed", label: "Date First Listed", category: "Dates" },
  { key: "date_last_updated", label: "Date Last Updated", category: "Dates" },
  { key: "created_at", label: "Created At", category: "Dates" },
  { key: "updated_at", label: "Updated At", category: "Dates" },

  // ── AI Surfaces ──
  { key: "ai_surfaces_total_7d", label: "Total Bot Crawls (7d)", category: "AI Surfaces" },
  { key: "ai_surfaces_meta", label: "Surfaces: Meta AI", category: "AI Surfaces" },
  { key: "ai_surfaces_google", label: "Surfaces: Google", category: "AI Surfaces" },
  { key: "ai_surfaces_apple", label: "Surfaces: Apple", category: "AI Surfaces" },
  { key: "ai_surfaces_perplexity", label: "Surfaces: Perplexity", category: "AI Surfaces" },
  { key: "ai_surfaces_chatgpt", label: "Surfaces: ChatGPT", category: "AI Surfaces" },
  { key: "ai_surfaces_claude", label: "Surfaces: Claude", category: "AI Surfaces" },
  { key: "ai_surfaces_bing", label: "Surfaces: Bing", category: "AI Surfaces" },
  { key: "ai_surfaces_gptbot", label: "Surfaces: GPTBot", category: "AI Surfaces" },
  { key: "ai_surfaces_other", label: "Surfaces: Other", category: "AI Surfaces" },
  { key: "ai_surfaces_human", label: "Surfaces: Human-Initiated", category: "AI Surfaces" },
  { key: "ai_surfaces_top5_bots", label: "Top 5 Bots (names)", category: "AI Surfaces" },

  // ── AIFS Score ──
  { key: "aifs_score", label: "AIFS Score", category: "AIFS" },
  { key: "aifs_band", label: "AIFS Band", category: "AIFS" },
  { key: "aifs_serp_knowledge_graph", label: "Knowledge Graph", category: "AIFS" },
  { key: "aifs_serp_sitelink_salience", label: "Sitelink Salience", category: "AIFS" },
  { key: "aifs_serp_related_citations", label: "Related Citations", category: "AIFS" },
  { key: "aifs_serp_third_party_count", label: "Third-Party Count", category: "AIFS" },
  { key: "aifs_serp_visibility_score", label: "SERP Visibility Score", category: "AIFS" },
  { key: "aifs_data_freshness_days", label: "Data Freshness (days)", category: "AIFS" },
  { key: "aifs_data_freshness_score", label: "Data Freshness Score", category: "AIFS" },
  { key: "aifs_selection_rationale", label: "Selection Rationale", category: "AIFS" },
  { key: "aifs_crypto_verified", label: "Crypto Verified", category: "AIFS" },
  { key: "aifs_internal_score", label: "Internal Score", category: "AIFS" },
  { key: "aifs_gap_analysis", label: "Gap Analysis", category: "AIFS" },
  { key: "footprint_context", label: "Footprint Context", category: "AIFS" },

  // ── System ──
  { key: "id", label: "Agent ID", category: "System" },
];

/** Get unique category names in order */
export function getCategories(): string[] {
  const seen = new Set<string>();
  return MERGE_VARIABLES.filter((v) => {
    if (seen.has(v.category)) return false;
    seen.add(v.category);
    return true;
  }).map((v) => v.category);
}

/** Format a key as a merge tag: {{key}}, or as an <a> tag if it's a link */
export function toMergeTag(key: string): string {
  const v = MERGE_VARIABLES.find((m) => m.key === key);
  if (v?.linkText) {
    return `<a href="{{${key}}}">${v.linkText}</a>`;
  }
  return `{{${key}}}`;
}
