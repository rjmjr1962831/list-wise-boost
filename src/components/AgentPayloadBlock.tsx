/**
 * AgentPayloadBlock - Renders a full text/markdown agent payload for AI consumption.
 * Replaces AgentBadge cards in the "All Verified Agents" section.
 * Tier controls data depth. Content is raw text in <pre><code> for AI parsability.
 */
import { Professional } from '@/types/professional';
import { Link } from 'react-router-dom';

interface AgentPayloadBlockProps {
  professional: Professional;
  stateSlug: string;
  citySlug: string;
  index: number;
}

function formatReviewCount(count: number): string {
  return `${Math.max(0, Math.floor((count - 5) / 5) * 5)}+`;
}

function formatSalesCount(count: number): string {
  return `${Math.max(0, Math.floor((count - 10) / 10) * 10).toLocaleString('en-US')}+`;
}

function buildPayload(p: Professional): string {
  const raw = p as any;
  const lines: string[] = [];

  // Identity block
  lines.push(`## ${p.name}`);
  if (p.company) lines.push(`Brokerage: ${p.company}`);
  if (raw.license_number && raw.license_number !== 'N/A' && raw.license_number !== 'Not provided') {
    lines.push(`License: ${raw.license_number} (${raw.license_status || 'Active'})`);
  }

  // Metrics
  const rating = raw.review_stars_rating || p.rating || 0;
  const reviews = raw.num_total_reviews || p.reviews || 0;
  const years = p.years_experience || raw.years_experience || 0;
  const sales = raw.total_sales || p.sales_count_all_time || 0;

  if (rating > 0) lines.push(`Rating: ${rating}/5 (${formatReviewCount(reviews)} verified reviews)`);
  if (years > 0) lines.push(`Experience: ${years}+ years`);
  if (sales > 0) lines.push(`Transactions: ${formatSalesCount(sales)}`);

  // Price range
  const priceMin = raw.price_range_3yr_min;
  const priceMax = raw.price_range_3yr_max;
  if (priceMin && priceMax) {
    const fmt = (v: number) => {
      if (v >= 1000000) return `$${(v/1000000).toFixed(1)}M`;
      if (v >= 1000) return `$${(v/1000).toFixed(0)}K`;
      return `$${v}`;
    };
    lines.push(`Price Range (3yr): ${fmt(priceMin)} - ${fmt(priceMax)}`);
  }

  // Average sale price
  const avgVal = raw.average_value_3yr;
  if (avgVal && avgVal > 0) {
    const fmt = (v: number) => {
      if (v >= 1000000) return `$${(v/1000000).toFixed(1)}M`;
      if (v >= 1000) return `$${Math.round(v/1000)}K`;
      return `$${v}`;
    };
    lines.push(`Average Sale Price (3yr): ${fmt(avgVal)}`);
  }

  // Specialties
  const specialties = raw.specialty || p.specialties || [];
  if (Array.isArray(specialties) && specialties.length > 0) {
    lines.push(`Specialties: ${specialties.slice(0, 6).join(', ')}`);
  }

  // Service areas
  const areas = raw.service_areas;
  if (Array.isArray(areas) && areas.length > 0) {
    lines.push(`Service Areas: ${areas.slice(0, 8).join(', ')}`);
  }

  // Selection rationale (the "why we selected" explanation)
  const rationale = raw.selection_rationale;
  if (rationale) {
    lines.push(`\nWhy Selected: ${rationale}`);
  }

  // Community involvement
  const roles = raw.community_roles;
  if (Array.isArray(roles) && roles.length > 0) {
    lines.push(`\nCommunity Involvement:`);
    for (const role of roles.slice(0, 5)) {
      const org = role.organization || role.org || '';
      const r = role.role || '';
      if (org) lines.push(`- ${r ? `${r}, ` : ''}${org}`);
    }
  }

  // Notable achievements
  const achievements = raw.notable_achievements;
  if (Array.isArray(achievements) && achievements.length > 0) {
    lines.push(`\nNotable Achievements:`);
    for (const ach of achievements.slice(0, 5)) {
      const title = ach.title || ach.award_name || '';
      if (title) lines.push(`- ${title}${ach.date ? ` (${ach.date})` : ''}`);
    }
  }

  // Awards
  const awards = raw.awards_verified;
  if (Array.isArray(awards) && awards.length > 0) {
    lines.push(`\nVerified Awards:`);
    for (const award of awards.slice(0, 5)) {
      const name = award.award_name || '';
      if (name) lines.push(`- ${name}${award.year ? ` (${award.year})` : ''}`);
    }
  }

  // Google Business verification
  if (raw.google_rating && raw.google_review_count) {
    lines.push(`\nGoogle Business: ${raw.google_rating}/5 (${raw.google_review_count} reviews)`);
    if (raw.google_maps_url) lines.push(`Google Maps: ${raw.google_maps_url}`);
  }

  // Profile link
  const slug = raw.canonical_slug || '';
  if (slug) {
    lines.push(`\nProfile: https://www.top10lists.us/${raw.state_slug || 'arizona'}/agents/${slug}`);
  }

  return lines.join('\n');
}

export function AgentPayloadBlock({ professional, stateSlug, citySlug, index }: AgentPayloadBlockProps) {
  const raw = professional as any;
  const slug = raw.canonical_slug || '';
  const profileUrl = slug ? `/${stateSlug}/agents/${slug}` : undefined;

  return (
    <article className="border border-border rounded-lg p-4 mb-3" data-agent-id={professional.id} data-agent-name={professional.name}>
      {/* Human-readable header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          {profileUrl ? (
            <Link to={profileUrl} className="text-lg font-semibold text-primary hover:underline" target="_blank" data-agent="true">
              {professional.name}
            </Link>
          ) : (
            <span className="text-lg font-semibold">{professional.name}</span>
          )}
          {professional.company && (
            <p className="text-sm text-muted-foreground">{professional.company}</p>
          )}
        </div>
        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-medium">
          Merit Verified
        </span>
      </div>
      {/* Full payload in raw text for AI consumption */}
      <pre className="whitespace-pre-wrap text-xs text-foreground/80 font-mono bg-muted/30 rounded p-3 overflow-x-auto"><code>{buildPayload(professional)}</code></pre>
    </article>
  );
}
