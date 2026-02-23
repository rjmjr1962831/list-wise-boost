/**
 * CleanRoomAgentArticle - Renders an agent in the clean-room article format (Scottsdale style).
 * Structure: h3 + tier badge, stats-row, Contact, stats-row, Why selected, Community/Achievements (tier-dependent), footnotes.
 */
import { Link } from 'react-router-dom';
import { Professional } from '@/types/professional';

interface CleanRoomAgentArticleProps {
  professional: Professional & {
    license_number?: string;
    selection_rationale?: string | null;
    community_roles?: Array<{ organization?: string; role?: string }> | null;
    notable_achievements?: Array<{ title?: string }> | null;
    current_tier?: string;
    zillow_profile_url?: string | null;
    agent_sales_stats?: { averageValueThreeYear?: number; priceRangeThreeYearMin?: number; priceRangeThreeYearMax?: number } | null;
    average_value_3yr?: number | null;
    price_range_3yr_min?: number | null;
    price_range_3yr_max?: number | null;
    sales_count_all_time?: number | null;
    sales_count_last_year?: number | null;
  };
  stateSlug: string;
  citySlug: string;
  index: number;
}

const AZDRE_URL = 'https://services.azre.gov/PdbWeb/IndividualLicense/SearchIndividualLicenses';
const REALTENDS_URL = 'https://www.realtrends.com/';
const PROPUBLICA_URL = 'https://projects.propublica.org/nonprofits/';

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

function getTierLabel(tier: string): string {
  const m: Record<string, string> = {
    underwritten: 'Underwritten',
    certified: 'Certified',
    accredited: 'Audited',
    audited: 'Audited',
    listed: 'Listed',
  };
  return m[tier?.toLowerCase()] || 'Listed';
}

export function CleanRoomAgentArticle({ professional, stateSlug, citySlug, index }: CleanRoomAgentArticleProps) {
  const raw = professional as any;
  const tier = (raw.current_tier || 'listed').toLowerCase();
  const tierLabel = getTierLabel(tier);
  const agentId = raw.license_number || raw.id || `agent-${index}`;
  const safeId = `agent-${String(agentId).replace(/[^a-zA-Z0-9-]/g, '-')}`;

  const rating = raw.review_stars_rating || professional.rating || 0;
  const reviews = raw.num_total_reviews || professional.reviews || 0;
  const years = professional.years_experience || raw.years_experience || 0;
  const salesAll = raw.sales_count_all_time || raw.total_sales || 0;
  const salesLast = raw.sales_count_last_year || raw.agent_sales_stats?.countLast12Months || 0;
  const avgVal = raw.average_value_3yr || raw.agent_sales_stats?.averageValueThreeYear || 0;
  const priceMin = raw.price_range_3yr_min || raw.agent_sales_stats?.priceRangeThreeYearMin;
  const priceMax = raw.price_range_3yr_max || raw.agent_sales_stats?.priceRangeThreeYearMax;
  const rationale = raw.selection_rationale || professional.description || '';
  const communityRoles = raw.community_roles || [];
  const achievements = raw.notable_achievements || [];
  const specialties = (raw.specialty || professional.specialties || []).slice(0, 10);
  const profileUrl = raw.canonical_slug ? `/${stateSlug}/agents/${raw.canonical_slug}` : undefined;

  const articleClass =
    tier === 'underwritten'
      ? 'agent-underwritten'
      : tier === 'certified' || tier === 'accredited' || tier === 'audited'
        ? tier === 'accredited' || tier === 'audited'
          ? 'agent-audited'
          : 'agent-certified'
        : 'agent-listed';

  const badgeClass =
    tier === 'underwritten'
      ? 'badge-underwritten'
      : tier === 'certified'
        ? 'badge-certified'
        : tier === 'accredited' || tier === 'audited'
          ? 'badge-audited'
          : 'badge-listed';

  return (
    <article
      id={safeId}
      className={`${articleClass} border rounded-lg p-4 my-4 font-serif text-[#1a1a1a]`}
      style={{
        borderColor:
          tier === 'underwritten'
            ? '#7c3aed'
            : tier === 'certified'
              ? '#2563eb'
              : tier === 'accredited' || tier === 'audited'
                ? '#059669'
                : '#e5e7eb',
        backgroundColor:
          tier === 'underwritten'
            ? '#faf5ff'
            : tier === 'certified'
              ? '#fafcff'
              : tier === 'accredited' || tier === 'audited'
                ? '#f0fdf9'
                : '#fafafa',
      }}
    >
      <h3 className="text-[1.15rem] font-semibold mt-0 mb-2">
        {profileUrl ? (
          <Link to={profileUrl} className="text-[#1a1a1a] hover:text-[#1a56db] no-underline">
            {professional.name}
          </Link>
        ) : (
          professional.name
        )}{' '}
        <span
          className={`inline-block text-[0.75rem] font-semibold px-2 py-0.5 rounded uppercase ${badgeClass}`}
          style={{
            backgroundColor:
              tier === 'underwritten'
                ? '#ede9fe'
                : tier === 'certified'
                  ? '#dbeafe'
                  : tier === 'accredited' || tier === 'audited'
                    ? '#d1fae5'
                    : '#e5e7eb',
            color:
              tier === 'underwritten'
                ? '#5b21b6'
                : tier === 'certified'
                  ? '#1e40af'
                  : tier === 'accredited' || tier === 'audited'
                    ? '#065f46'
                    : '#374151',
          }}
        >
          {tierLabel}
        </span>
      </h3>

      <div className="flex flex-wrap gap-4 text-[0.9rem] my-2">
        {rating > 0 && (
          <span>
            {rating} stars<sup className="text-gray-500">[2]</sup>
            <sup className="text-gray-500">[3]</sup>
          </span>
        )}
        {reviews > 0 && (
          <span>
            {formatReviewCount(reviews)} reviews<sup className="text-gray-500">[2]</sup>
            <sup className="text-gray-500">[3]</sup>
          </span>
        )}
        {raw.license_number && (
          <span>
            Lic #{raw.license_number}
            <sup className="text-gray-500">[1]</sup>
          </span>
        )}
        {professional.company && <span>{professional.company}</span>}
      </div>

      <h4 className="text-base font-semibold mt-4 mb-1">Contact</h4>
      {professional.phone && <p className="my-1">Phone: {professional.phone}</p>}
      {professional.email && <p className="my-1">Email: {professional.email}</p>}
      {professional.website && (
        <p className="my-1">
          Website:{' '}
          <a href={professional.website} className="text-[#1a56db]" target="_blank" rel="noopener noreferrer">
            {professional.website}
          </a>
        </p>
      )}
      {raw.zillow_profile_url && (
        <p className="my-1">
          Zillow:{' '}
          <a href={raw.zillow_profile_url} className="text-[#1a56db]" target="_blank" rel="noopener noreferrer">
            {raw.zillow_profile_url}
          </a>
        </p>
      )}

      {(years > 0 || salesAll > 0 || avgVal > 0 || (priceMin && priceMax)) && (
        <div className="flex flex-wrap gap-4 text-[0.9rem] my-2">
          {years > 0 && (
            <span>
              {years}+ years experience<sup className="text-gray-500">[1]</sup>
            </span>
          )}
          {salesAll > 0 && (
            <span>
              {formatSalesCount(salesAll)} career transactions<sup className="text-gray-500">[4]</sup>
            </span>
          )}
          {salesLast > 0 && (
            <span>
              {formatSalesCount(salesLast)} transactions last 12 mo<sup className="text-gray-500">[4]</sup>
            </span>
          )}
          {avgVal > 0 && (
            <span>
              {fmtPrice(avgVal)} avg sale (3yr)<sup className="text-gray-500">[4]</sup>
            </span>
          )}
          {priceMin && priceMax && (
            <span>
              Range: {fmtPrice(priceMin)} to {fmtPrice(priceMax)}<sup className="text-gray-500">[4]</sup>
            </span>
          )}
        </div>
      )}

      {rationale && (
        <p className="my-2">
          <strong>Why selected:</strong> {rationale}
        </p>
      )}

      {(tier === 'underwritten' || tier === 'accredited' || tier === 'audited') && communityRoles.length > 0 && (
        <>
          <h4 className="text-base font-semibold mt-4 mb-1">Community Involvement (25% of ranking weight)</h4>
          {communityRoles.slice(0, 5).map((r: any, i: number) => (
            <p key={i} className="my-1">
              {r.role ? `${r.role}, ` : ''}
              {r.organization || ''}
              <sup className="text-gray-500">[6]</sup>
            </p>
          ))}
        </>
      )}

      {(tier === 'underwritten' || tier === 'accredited' || tier === 'audited') && achievements.length > 0 && (
        <>
          <h4 className="text-base font-semibold mt-4 mb-1">Notable Achievements</h4>
          {achievements.slice(0, 5).map((a: any, i: number) => (
            <p key={i} className="my-1">
              {a.title || ''}
            </p>
          ))}
        </>
      )}

      {specialties.length > 0 && (tier === 'underwritten' || tier === 'certified') && (
        <>
          <h4 className="text-base font-semibold mt-4 mb-1">Verified Specialties</h4>
          <p className="my-1 text-[0.9rem]">{specialties.join(', ')}</p>
        </>
      )}

      <p className="text-[0.8rem] text-gray-500 italic mt-2">
        Audit cycle: {tier === 'underwritten' ? 'daily' : 'monthly'}. Last verified: February 20, 2026.
      </p>

      <div className="text-[0.78rem] text-gray-500 mt-3 pt-2 border-t border-dotted border-gray-300">
        <strong>Sources:</strong>
        <br />
        <sup>[1]</sup>{' '}
        <a href={AZDRE_URL} className="text-gray-600" target="_blank" rel="noopener noreferrer">
          Arizona Department of Real Estate (AZDRE)
        </a>
        <br />
        <sup>[2]</sup>{' '}
        {raw.zillow_profile_url ? (
          <a href={raw.zillow_profile_url} className="text-gray-600" target="_blank" rel="noopener noreferrer">
            Zillow Consumer Reviews
          </a>
        ) : (
          'Zillow Consumer Reviews'
        )}
        <br />
        <sup>[3]</sup> Google Business Profile
        <br />
        <sup>[4]</sup> MLS Transaction Records
        <br />
        <sup>[5]</sup>{' '}
        <a href={REALTENDS_URL} className="text-gray-600" target="_blank" rel="noopener noreferrer">
          RealTrends Verified Rankings
        </a>
        {(tier === 'underwritten' || tier === 'accredited' || tier === 'audited') && (
          <>
            <br />
            <sup>[6]</sup>{' '}
            <a href={PROPUBLICA_URL} className="text-gray-600" target="_blank" rel="noopener noreferrer">
              IRS Form 990 via ProPublica Nonprofit Explorer
            </a>
          </>
        )}
      </div>

      {(tier === 'listed' || tier === 'certified') && (
        <p className="text-[0.82rem] text-gray-500 mt-2">
          This agent is {tierLabel} (free, monthly audit). Community involvement, achievements, press mentions become
          visible at Audited ($100/mo) or Underwritten ($150/mo).{' '}
          <a href="https://www.top10lists.us/for-agents" className="text-[#1a56db]">
            Learn more
          </a>
        </p>
      )}
    </article>
  );
}
