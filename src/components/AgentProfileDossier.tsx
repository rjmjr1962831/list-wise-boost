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

  const verificationLabel = `Verification: Updated ${formatMonthYear(verificationUpdatedAt)}`;

  const contact = useMemo(() => {
    return {
      phone: agent.phoneNumbers?.cell || agent.phoneNumbers?.business || null,
      email: agent.email || null,
      website: agent.getToKnowMe?.websiteUrl || null,
    };
  }, [agent]);

  const keyStats = useMemo(() => {
    const tiles: { label: string; value: string }[] = [];

    const yearsActive = license?.originalIssueDate
      ? computeYearsActive(license.originalIssueDate)
      : null;

    if (yearsActive) {
      tiles.push({ label: "Years active", value: yearsActive.toString() });
    }

    if (agent.ratings?.average && agent.ratings?.count) {
      tiles.push({
        label: "Reviews",
        value: `${agent.ratings.average.toFixed(1)} (${agent.ratings.count})`,
      });
    }

    if (agent.agentSalesStats?.countAllTime) {
      tiles.push({
        label: "Transactions",
        value: agent.agentSalesStats.countAllTime.toLocaleString(),
      });
    }

    if (agent.agentSalesStats?.countLastYear) {
      tiles.push({
        label: "Past 12 months",
        value: agent.agentSalesStats.countLastYear.toLocaleString(),
      });
    }

    if (agent.forSaleListings?.listing_count) {
      tiles.push({
        label: "Active listings",
        value: agent.forSaleListings.listing_count.toLocaleString(),
      });
    }

    if (
      agent.agentSalesStats?.priceRangeThreeYearMin &&
      agent.agentSalesStats?.priceRangeThreeYearMax &&
      agent.agentSalesStats.priceRangeThreeYearMin > 0 &&
      agent.agentSalesStats.priceRangeThreeYearMax > 0
    ) {
      tiles.push({
        label: "3-year range",
        value: `${formatCurrency(agent.agentSalesStats.priceRangeThreeYearMin)} – ${formatCurrency(agent.agentSalesStats.priceRangeThreeYearMax)}`,
      });
    }

    return tiles.slice(0, 6);
  }, [agent, license]);

  // Deduplicate specialties (case-insensitive) and limit to 8
  const specialties = useMemo(() => {
    const raw = agent.getToKnowMe?.specialties?.filter(Boolean) ?? [];
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const s of raw) {
      const lower = s.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        unique.push(s);
      }
    }
    return unique.slice(0, 8);
  }, [agent]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-10">
        {/* LEFT RAIL */}
        <aside className="lg:sticky lg:top-6 self-start">
          <Card className="p-4 space-y-4">
            <header>
              <div className="flex gap-4">
                <div className="h-20 w-20 overflow-hidden rounded-xl border bg-slate-100 flex-shrink-0">
                  {isValidImageUrl(agent.profilePhotoSrc) ? (
                    <img
                      src={agent.profilePhotoSrc!}
                      alt={agent.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-slate-400">
                      <span className="text-2xl">{agent.name.charAt(0)}</span>
                    </div>
                  )}
                </div>
                <div>
                  <h1 className="text-lg font-semibold">{agent.name}</h1>
                  {agent.businessName ? (
                    <div className="text-sm text-slate-600">{agent.businessName}</div>
                  ) : null}
                  <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">
                    {verificationLabel}
                  </span>
                </div>
              </div>
            </header>

            {keyStats.length > 0 && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-2">
                  {keyStats.map((t) => (
                    <div key={t.label} className="rounded-lg border px-3 py-2">
                      <div className="text-[11px] uppercase text-slate-500">{t.label}</div>
                      <div className="text-sm font-semibold">{t.value}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {(contact.phone || contact.email || contact.website) && (
              <>
                <Separator />
                <SectionTitle title="Contact" />
                <div className="space-y-2">
                  {contact.phone && <InfoRow label="Phone" value={contact.phone} />}
                  {contact.email && <InfoRow label="Email" value={contact.email} />}
                  {contact.website && (
                    <InfoRow label="Website" value={prettyDomain(contact.website)} />
                  )}
                </div>
              </>
            )}

            {license && (
              <>
                <Separator />
                <SectionTitle title="License" />
                <div className="space-y-2">
                  <InfoRow label="Number" value={license.licenseNumber} />
                  {license.licenseType && <InfoRow label="Type" value={license.licenseType} />}
                  {license.originalIssueDate && (
                    <InfoRow label="Originally issued" value={formatDateShort(license.originalIssueDate)} />
                  )}
                  <InfoRow label="Verified by" value={license.agencyName} />
                </div>
              </>
            )}

            {specialties.length > 0 && (
              <>
                <Separator />
                <SectionTitle title="Specialties" />
                <div className="flex flex-wrap gap-2">
                  {specialties.map((s) => (
                    <span key={s} className="rounded-full border px-2.5 py-0.5 text-xs">
                      {s}
                    </span>
                  ))}
                </div>
              </>
            )}
          </Card>
        </aside>

        {/* RIGHT COLUMN */}
        <main className="space-y-4 mt-6 lg:mt-0">
          {/* About section - from get_to_know_me (agent's own words) */}
          {getToKnowMe && (
            <DetailsSection id="about" title={`About ${agent.name}`} defaultOpen>
              <div
                className="prose prose-sm max-w-none text-slate-700"
                dangerouslySetInnerHTML={{ __html: getToKnowMe }}
              />
            </DetailsSection>
          )}

          {/* Why Top10Lists Recommends - from synthesized_bio */}
          {/* Auto-expand if there's no About section */}
          {synthesizedBio && (
            <DetailsSection id="synthesis" title="Why Top10Lists Recommends This Agent" defaultOpen={!getToKnowMe}>
              <div
                className="prose prose-sm max-w-none text-slate-700"
                dangerouslySetInnerHTML={{ __html: synthesizedBio }}
              />
            </DetailsSection>
          )}

          {/* Selected Reviews */}
          {props.selectedReviews && props.selectedReviews.length > 0 && (
            <DetailsSection id="reviews" title="Selected client feedback">
              <ReviewList reviews={props.selectedReviews} />
            </DetailsSection>
          )}
        </main>
      </div>
    </div>
  );
}

/* -------------------------------------------------
   Subcomponents
-------------------------------------------------- */

function SectionTitle({ title }: { title: string }) {
  return <div className="text-xs font-semibold uppercase text-slate-700">{title}</div>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase text-slate-500">{label}</div>
      <div className="text-sm break-words">{value}</div>
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
      <Card className="p-4">
        <details open={defaultOpen}>
          <summary className="cursor-pointer text-sm font-semibold list-none">
            <span className="inline-block mr-2 transition-transform details-marker">▶</span>
            {title}
          </summary>
          <div className="mt-3">{children}</div>
        </details>
      </Card>
      <style>{`
        details[open] .details-marker {
          transform: rotate(90deg);
        }
      `}</style>
    </section>
  );
}

/* -------------------------------------------------
   ReviewList with stale-date logic
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
          <div key={i} className="rounded-lg border p-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {r.rating ? <span>Rating: {r.rating}</span> : null}
              {isOld ? (
                <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-[10px]">
                  Verified Past Client
                </span>
              ) : r.createdAt ? (
                <span>{formatDateShort(r.createdAt)}</span>
              ) : null}
            </div>
            <div className="mt-1 text-sm">{r.text}</div>
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
  // Reject non-image URLs
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return false;
  if (lower.includes('facebook.com') || lower.includes('twitter.com')) return false;
  if (lower.includes('linkedin.com') || lower.includes('instagram.com')) return false;
  // Must look like an image or a CDN URL
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
