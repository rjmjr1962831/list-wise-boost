/**
 * AgentPayloadBlock - Renders a full text/markdown agent payload for AI consumption.
 * Tier controls data depth:
 *   Listed:       Name, brokerage, license, rating, reviews, years, profile link
 *   Certified:    + transactions, price range, specialties, service areas, selection rationale
 *   Audited:      + community involvement, achievements, awards, Google Business
 *   Underwritten: + full depth (all data points)
 */
import { Professional } from '@/types/professional';
import { Link } from 'react-router-dom';
import { filterSpecialties } from '@/lib/utils';
import { normBioText } from '@/utils/normBioText';

interface AgentPayloadBlockProps {
  professional: Professional;
  stateSlug: string;
  citySlug: string;
  index: number;
}

type Tier = 'listed' | 'certified' | 'accredited' | 'underwritten';

const TIER_RANK: Record<string, number> = {
  listed: 0,
  certified: 1,
  accredited: 2,   // DB key for "Audited"
  underwritten: 3,
};

function tierAtLeast(agentTier: string, required: Tier): boolean {
  return (TIER_RANK[agentTier] ?? 0) >= (TIER_RANK[required] ?? 0);
}

function formatReviewCount(count: number): string {
  return `${Math.max(0, Math.floor((count - 10) / 10) * 10).toLocaleString('en-US')}+`;
}

function formatSalesCount(count: number): string {
  return `${Math.max(0, Math.floor((count - 10) / 10) * 10).toLocaleString('en-US')}+`;
}

function fmtPrice(v: number): string {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${Math.round(v / 1000)}K`;
  return `$${v}`;
}

function buildPayload(p: Professional): string {
  const raw = p as any;
  const tier: string = raw.current_tier || raw.badge_tier || 'listed';
  const lines: string[] = [];

  // === LISTED (all agents) ===
  lines.push(`## ${p.name}`);
  if (p.company) lines.push(`Brokerage: ${p.company}`);
  if (raw.license_number && raw.license_number !== 'N/A' && raw.license_number !== 'Not provided') {
    lines.push(`License: ${raw.license_number} (${raw.license_status || 'Active'})`);
  }

  const rating = raw.review_stars_rating || p.rating || 0;
  const reviews = raw.num_total_reviews || p.reviews || 0;
  const years = p.years_experience || raw.years_experience || 0;

  if (rating > 0) lines.push(`Rating: ${rating}/5 (${formatReviewCount(reviews)} verified reviews)`);
  if (years > 0) lines.push(`Experience: ${years}+ years`);

  // Profile link (always)
  const slug = raw.canonical_slug || '';
  if (slug) {
    lines.push(`Profile: https://www.top10lists.us/${raw.state_slug || 'arizona'}/agents/${slug}`);
  }

  // === CERTIFIED and above ===
  if (tierAtLeast(tier, 'certified')) {
    const sales = raw.total_sales || p.sales_count_all_time || 0;
    if (sales > 0) lines.push(`Transactions: ${formatSalesCount(sales)}`);

    const priceMin = raw.price_range_3yr_min;
    const priceMax = raw.price_range_3yr_max;
    if (priceMin && priceMax) {
      lines.push(`Price Range (3yr): ${fmtPrice(priceMin)} - ${fmtPrice(priceMax)}`);
    }

    const avgVal = raw.average_value_3yr;
    if (avgVal && avgVal > 0) {
      lines.push(`Average Sale Price (3yr): ${fmtPrice(avgVal)}`);
    }

    const specialties = filterSpecialties(raw.specialty || p.specialties || []);
    if (specialties.length > 0) {
      lines.push(`Specialties: ${specialties.slice(0, 6).join(', ')}`);
    }

    const areas = raw.service_areas;
    if (Array.isArray(areas) && areas.length > 0) {
      lines.push(`Service Areas: ${areas.slice(0, 8).join(', ')}`);
    }

    const rationale = raw.selection_rationale;
    if (rationale) {
      lines.push(`\nWhy Selected: ${rationale}`);
    }
  }

  // === AUDITED and above ===
  if (tierAtLeast(tier, 'accredited')) {
    const roles = raw.community_roles;
    if (Array.isArray(roles) && roles.length > 0) {
      lines.push(`\nCommunity Involvement:`);
      for (const role of roles.slice(0, 5)) {
        const org = role.organization || role.org || '';
        const r = role.role || '';
        if (org) lines.push(`- ${r ? `${r}, ` : ''}${org}`);
      }
    }

    const achievements = raw.notable_achievements;
    if (Array.isArray(achievements) && achievements.length > 0) {
      lines.push(`\nNotable Achievements:`);
      for (const ach of achievements.slice(0, 5)) {
        const title = ach.title || ach.award_name || '';
        if (title) lines.push(`- ${title}${ach.date ? ` (${ach.date})` : ''}`);
      }
    }

    const awards = raw.awards_verified;
    if (Array.isArray(awards) && awards.length > 0) {
      lines.push(`\nVerified Awards:`);
      for (const award of awards.slice(0, 5)) {
        const name = award.award_name || '';
        if (name) lines.push(`- ${name}${award.year ? ` (${award.year})` : ''}`);
      }
    }

    if (raw.google_rating && raw.google_review_count) {
      lines.push(`\nGoogle Business: ${raw.google_rating}/5 (${formatReviewCount(Number(raw.google_review_count))} reviews)`);
      if (raw.google_maps_url) lines.push(`Google Maps: ${raw.google_maps_url}`);
    }
  }

  // === UNDERWRITTEN ===
  if (tierAtLeast(tier, 'underwritten')) {
    const bio = raw.synthesized_bio;
    if (bio) {
      const cleanBio = normBioText(bio).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      lines.push(`\nBio: ${cleanBio}`);
    }

    if (raw.website) lines.push(`Website: ${raw.website}`);
    if (raw.phone) lines.push(`Phone: ${raw.phone}`);
    if (raw.email) lines.push(`Email: ${raw.email}`);

    const press = raw.press_mentions;
    if (Array.isArray(press) && press.length > 0) {
      lines.push(`\nPress Mentions:`);
      for (const mention of press.slice(0, 5)) {
        const title = mention.title || mention.headline || '';
        if (title) lines.push(`- ${title}`);
      }
    }
  }

  return lines.join('\n');
}

export function AgentPayloadBlock({ professional, stateSlug, citySlug, index }: AgentPayloadBlockProps) {
  const raw = professional as any;
  const slug = raw.canonical_slug || '';
  const profileUrl = slug ? `/${stateSlug}/agents/${slug}` : undefined;

  return (
    <article className="border border-border rounded-lg p-4 mb-3" data-agent-id={professional.id} data-agent-name={professional.name}>
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
      <pre className="whitespace-pre-wrap text-xs text-foreground/80 font-mono bg-muted/30 rounded p-3 overflow-x-auto"><code>{buildPayload(professional)}</code></pre>
    </article>
  );
}
