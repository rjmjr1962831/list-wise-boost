import React, { useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

/* -------------------------------------------------
   Types
-------------------------------------------------- */

export type Memo23Agent = {
  name: string;
  businessName?: string | null;
  profilePhotoSrc?: string | null;
  email?: string | null;
  phoneNumbers?: {
    cell?: string | null;
    business?: string | null;
  } | null;
  ratings?: {
    average?: number | null;
    count?: number | null;
  } | null;
  agentSalesStats?: {
    countAllTime?: number | null;
    countLastYear?: number | null;
    priceRangeThreeYearMin?: number | null;
    priceRangeThreeYearMax?: number | null;
    averageValueThreeYear?: number | null;
  } | null;
  forSaleListings?: {
    listing_count?: number | null;
  } | null;
  getToKnowMe?: {
    description?: string | null;
    specialties?: string[] | null;
    websiteUrl?: string | null;
  } | null;
};

export type StateLicense = {
  licenseNumber: string;
  licenseType?: string | null;
  originalIssueDate?: string | null;
  agencyName: string;
};

export type Review = {
  text: string;
  rating?: number | null;
  createdAt?: string | null;
};

/* -------------------------------------------------
   Props
-------------------------------------------------- */

export type AgentProfileDossierProps = {
  agent: Memo23Agent;
  license?: StateLicense | null;
  verificationUpdatedAt: Date;
  getToKnowMe?: string | null;
  synthesizedBio?: string | null;
  selectedReviews?: Review[];
};

/* -------------------------------------------------
   Main Component
-------------------------------------------------- */

export default function AgentProfileDossier(props: AgentProfileDossierProps) {
  const { agent, license, verificationUpdatedAt, getToKnowMe, synthesizedBio } = props;

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }, []);

  const verificationLabel = `Updated ${formatMonthYear(verificationUpdatedAt)}`;

  const contact = useMemo(() => {
    return {
      phone: agent.phoneNumbers?.cell || agent.phoneNumbers?.business || null,
      email: agent.email || null,
      website: agent.getToKnowMe?.websiteUrl || null,
    };
  }, [agent]);

  // Build headline summary from stats
  const headlineSummary = useMemo(() => {
    const parts: string[] = [];
    
    const yearsActive = license?.originalIssueDate
      ? computeYearsActive(license.originalIssueDate)
      : null;
    
    if (yearsActive && yearsActive > 0) {
      parts.push(`${yearsActive} years of market experience`);
    }
    
    if (agent.agentSalesStats?.countAllTime) {
      parts.push(`${agent.agentSalesStats.countAllTime.toLocaleString()} transactions`);
    }
    
    if (agent.ratings?.average && agent.ratings?.count) {
      const stars = agent.ratings.average >= 4.8 ? "five-star" : `${agent.ratings.average.toFixed(1)}-star`;
      parts.push(`${agent.ratings.count.toLocaleString()} ${stars} reviews`);
    }
    
    return parts.length > 0 ? parts.join(". ") + "." : null;
  }, [agent, license]);

  // Deduplicate specialties (case-insensitive), filter generic ones, limit to 8
  const specialties = useMemo(() => {
    const raw = agent.getToKnowMe?.specialties?.filter(Boolean) ?? [];
    const seen = new Set<string>();
    const unique: string[] = [];
    
    // Generic specialties to ignore (everyone has these)
    const ignored = new Set(['buyer\'s agent', 'buyers agent', 'listing agent', 'seller\'s agent', 'sellers agent']);
    
    for (const s of raw) {
      const lower = s.toLowerCase();
      if (ignored.has(lower)) continue;
      if (!seen.has(lower)) {
        seen.add(lower);
        unique.push(s);
      }
    }
    return unique.slice(0, 8);
  }, [agent]);

  // Extract first paragraph from synthesized bio for the summary card
  const bioExcerpt = useMemo(() => {
    if (!synthesizedBio) return null;
    // Strip HTML tags and get first ~300 chars
    const text = synthesizedBio.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text.length <= 300) return text;
    const cut = text.slice(0, 300);
    const lastSpace = cut.lastIndexOf(' ');
    return cut.slice(0, lastSpace) + '...';
  }, [synthesizedBio]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
        {/* LEFT RAIL - Compact facts */}
        <aside className="lg:sticky lg:top-6 self-start">
          <Card className="p-4 space-y-4">
            {/* Header with photo and name */}
            <header>
              <div className="flex gap-3">
                <div className="h-16 w-16 overflow-hidden rounded-lg border bg-slate-100 flex-shrink-0">
                  {isValidImageUrl(agent.profilePhotoSrc) ? (
                    <img
                      src={agent.profilePhotoSrc!}
                      alt={agent.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-slate-400">
                      <span className="text-xl font-medium">{agent.name.charAt(0)}</span>
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <h1 className="text-base font-semibold leading-tight truncate">{agent.name}</h1>
                  {agent.businessName && (
                    <div className="text-xs text-slate-600 truncate">{agent.businessName}</div>
                  )}
                  <span className="mt-1 inline-flex rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700 font-medium">
                    Verified {verificationLabel}
                  </span>
                </div>
              </div>
            </header>

            {/* Contact */}
            {(contact.phone || contact.email || contact.website) && (
              <>
                <Separator />
                <div className="space-y-1.5">
                  <SectionTitle title="Contact" />
                  {contact.phone && <InfoRow label="Phone" value={contact.phone} />}
                  {contact.email && <InfoRow label="Email" value={contact.email} />}
                  {contact.website && <InfoRow label="Web" value={prettyDomain(contact.website)} />}
                </div>
              </>
            )}

            {/* License */}
            {license && (
              <>
                <Separator />
                <div className="space-y-1.5">
                  <SectionTitle title="License" />
                  <InfoRow label="Number" value={license.licenseNumber} />
                  {license.licenseType && <InfoRow label="Type" value={license.licenseType} />}
                  <InfoRow label="Verified by" value={license.agencyName} />
                </div>
              </>
            )}

            {/* Specialties */}
            {specialties.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <SectionTitle title="Specialties" />
                  <div className="flex flex-wrap gap-1.5">
                    {specialties.map((s) => (
                      <span key={s} className="rounded border px-2 py-0.5 text-[11px] bg-slate-50">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </Card>
        </aside>

        {/* RIGHT COLUMN - Stacked dossier */}
        <main className="space-y-4 mt-6 lg:mt-0">
          
          {/* 1. Recommendation Summary Card - Always visible, dense */}
          <Card className="p-5 border-l-4 border-l-primary">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-sm font-semibold text-slate-900">
                  Why Top10Lists Recommends This Agent
                </h2>
                <span className="text-[10px] text-slate-500 whitespace-nowrap">
                  Based on verified data
                </span>
              </div>
              
              {/* Headline stats */}
              {headlineSummary && (
                <p className="text-sm font-medium text-slate-800">
                  {headlineSummary}
                </p>
              )}
              
              {/* Bio excerpt */}
              {bioExcerpt && (
                <p className="text-sm text-slate-600 leading-relaxed">
                  {bioExcerpt}
                </p>
              )}
              
              {/* Evidence tiles - compact row */}
              <EvidenceTiles agent={agent} license={license} />
            </div>
          </Card>

          {/* 2. Professional Track Record - Open by default */}
          {synthesizedBio && (
            <DetailsSection id="track-record" title="Professional Track Record" defaultOpen>
              <div
                className="prose prose-sm max-w-none text-slate-700"
                dangerouslySetInnerHTML={{ __html: synthesizedBio }}
              />
            </DetailsSection>
          )}

          {/* 3. In Their Own Words (get_to_know_me) - Collapsed */}
          {getToKnowMe && (
            <DetailsSection id="about" title="In Their Own Words">
              <div
                className="prose prose-sm max-w-none text-slate-700"
                dangerouslySetInnerHTML={{ __html: getToKnowMe }}
              />
            </DetailsSection>
          )}

          {/* 4. Selected Client Feedback - Collapsed */}
          {props.selectedReviews && props.selectedReviews.length > 0 && (
            <DetailsSection id="reviews" title="Selected Client Feedback">
              <ReviewList reviews={props.selectedReviews} />
            </DetailsSection>
          )}
        </main>
      </div>
    </div>
  );
}

/* -------------------------------------------------
   Evidence Tiles - Compact stats row
-------------------------------------------------- */

function EvidenceTiles({ agent, license }: { agent: Memo23Agent; license?: StateLicense | null }) {
  const tiles: { label: string; value: string }[] = [];

  const yearsActive = license?.originalIssueDate
    ? computeYearsActive(license.originalIssueDate)
    : null;

  if (agent.agentSalesStats?.countAllTime) {
    tiles.push({ label: "Transactions", value: agent.agentSalesStats.countAllTime.toLocaleString() });
  }

  if (agent.ratings?.count) {
    tiles.push({ label: "Reviews", value: agent.ratings.count.toLocaleString() });
  }

  if (yearsActive && yearsActive > 0) {
    tiles.push({ label: "Years", value: yearsActive.toString() });
  }

  if (agent.agentSalesStats?.countLastYear) {
    tiles.push({ label: "Last 12mo", value: agent.agentSalesStats.countLastYear.toLocaleString() });
  }

  if (agent.forSaleListings?.listing_count) {
    tiles.push({ label: "Active", value: agent.forSaleListings.listing_count.toLocaleString() });
  }

  if (tiles.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
      {tiles.slice(0, 5).map((t) => (
        <div key={t.label} className="text-center">
          <div className="text-lg font-semibold text-slate-900">{t.value}</div>
          <div className="text-[10px] uppercase text-slate-500">{t.label}</div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------
   Subcomponents
-------------------------------------------------- */

function SectionTitle({ title }: { title: string }) {
  return <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">{title}</div>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-900 font-medium text-right break-words">{value}</span>
    </div>
  );
}

function DetailsSection({
  id,
  title,
  defaultOpen,
  children,
}: {
  id: string;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id}>
      <Card className="overflow-hidden">
        <details open={defaultOpen} className="group">
          <summary className="cursor-pointer px-5 py-3 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between list-none">
            <span className="text-sm font-semibold text-slate-800">{title}</span>
            <span className="text-slate-400 group-open:rotate-180 transition-transform">
              <ChevronIcon />
            </span>
          </summary>
          <div className="px-5 py-4">{children}</div>
        </details>
      </Card>
    </section>
  );
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/* -------------------------------------------------
   ReviewList
-------------------------------------------------- */

function ReviewList({ reviews }: { reviews: Review[] }) {
  const isOlderThanOneYear = (dateStr: string) => {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return false;
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    return d < cutoff;
  };

  return (
    <div className="space-y-3">
      {reviews.slice(0, 6).map((r, i) => {
        const isOld = r.createdAt && isOlderThanOneYear(r.createdAt);
        return (
          <div key={i} className="rounded-lg border p-3 bg-slate-50">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              {r.rating && <span className="font-medium">★ {r.rating}</span>}
              {isOld ? (
                <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px]">
                  Verified Past Client
                </span>
              ) : r.createdAt ? (
                <span>{formatDateShort(r.createdAt)}</span>
              ) : null}
            </div>
            <div className="text-sm text-slate-700 leading-relaxed">{r.text}</div>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------
   Helpers
-------------------------------------------------- */

function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return false;
  if (lower.includes('facebook.com') || lower.includes('twitter.com')) return false;
  if (lower.includes('linkedin.com') || lower.includes('instagram.com')) return false;
  const hasImageExt = /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url);
  const isZillowCdn = url.includes('zillowstatic.com') || url.includes('photos.zillowstatic.com');
  const isCloudinary = url.includes('cloudinary.com');
  return hasImageExt || isZillowCdn || isCloudinary;
}

function formatCurrency(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatMonthYear(d: Date) {
  return d.toLocaleString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function prettyDomain(url: string) {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function computeYearsActive(originalDateLike: string) {
  const start = new Date(originalDateLike);
  if (Number.isNaN(start.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  const m = now.getMonth() - start.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < start.getDate())) {
    years--;
  }
  return years > 0 ? years : 0;
}
