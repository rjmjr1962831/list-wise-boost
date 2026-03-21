import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { floorSales } from "@/utils/floorDisplay";

/** State abbreviation to state DRE name for sources. */
function getStateDreName(stateSlug: string | null | undefined): string {
  if (!stateSlug) return "State DRE";
  const s = (stateSlug || "").toUpperCase();
  const map: Record<string, string> = {
    AZ: "AZDRE",
    CA: "CADRE",
    NV: "Nevada Real Estate Division",
  };
  return map[s] || `${s} Department of Real Estate`;
}

/** Format date for display. */
function formatDate(val: string | null | undefined): string {
  if (!val) return "—";
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

/** Expander showing data fields and sources for a tier. Human-facing, not markdown. */
export function DataPayloadExpander({
  tier,
  triggerText,
  professional,
}: {
  tier: "certified" | "audited" | "underwritten";
  triggerText: string;
  professional?: Record<string, unknown> | null;
}) {
  const [open, setOpen] = useState(false);

  const certifiedSources = [
    "Google",
    "Zillow",
    "MLS",
    getStateDreName((professional?.license_state ?? professional?.state_slug) as string | null),
    "National, Regional and Local publications",
  ];

  const certifiedDataRows =
    tier === "certified" && professional
      ? [
          { label: "Brokerage", value: (professional.company ?? professional.business_name ?? "—") as string },
          { label: "Date last audited", value: formatDate((professional.last_diligence_check ?? professional.last_verified_at) as string | null) },
          {
            label: "Selection rationale",
            value: professional.selection_rationale
              ? (() => {
                  const s = String(professional.selection_rationale);
                  return s.length > 120 ? s.slice(0, 120) + "…" : s;
                })()
              : "—",
          },
          { label: "Lifetime sales", value: professional.total_sales != null ? (floorSales(professional.total_sales) ?? "—") : "—" },
          { label: "Next audit date", value: formatDate((professional.annual_review_date ?? professional.next_bill_date) as string | null) },
          {
            label: "Cities served",
            value: Array.isArray(professional.service_areas)
              ? (professional.service_areas as string[]).join(", ") || "—"
              : typeof professional.service_areas === "string"
                ? professional.service_areas
                : "—",
          },
        ]
      : null;

  const content: Record<string, { data: string[]; sources: string[] }> = {
    audited: {
      data: [
        "Expanded background research (credentials, transactions, community service, career trajectory)",
        "Years of experience",
        "Total transactions",
        "Company name",
        "Community roles and organizations",
        "Notable achievements",
        "Civic involvement (IRS 990 verified)",
        "Transaction history",
        "Specialties",
      ],
      sources: [
        "State DRE",
        "Zillow",
        "IRS 990 filings",
        "Verified transaction records",
      ],
    },
    underwritten: {
      data: [
        "Exhaustive background research (credentials, transactions, community service, career trajectory, press coverage)",
        "Years of experience",
        "Total transactions",
        "Company name",
        "Community roles and organizations",
        "Notable achievements",
        "Civic involvement (IRS 990 verified)",
        "Transaction history",
        "Specialties",
        "Certifications and designations",
        "Neighborhood expertise",
        "Press mentions",
        "Awards",
        "Performance data (sales count, last verified)",
      ],
      sources: [
        "State DRE",
        "Zillow",
        "IRS 990 filings",
        "Verified transaction records",
        "Neighborhood transaction data",
        "Press and awards verification",
      ],
    },
  };

  const isCertifiedWithData = tier === "certified" && certifiedDataRows;
  const dataDisplay = isCertifiedWithData
    ? certifiedDataRows
    : content[tier]?.data.map((item) => ({ label: null as string | null, value: item })) ?? [];
  const sourcesDisplay = isCertifiedWithData ? certifiedSources : content[tier]?.sources ?? [];

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-medium"
      >
        {triggerText}
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <div className="mt-2 p-3 rounded-lg border bg-muted/30 text-sm space-y-2">
          <div>
            <p className="font-medium text-foreground mb-1">Data included</p>
            {isCertifiedWithData ? (
              <dl className="text-muted-foreground space-y-1">
                {certifiedDataRows!.map((row, i) => (
                  <div key={i} className="flex gap-2">
                    <dt className="font-medium text-foreground shrink-0">{row.label}:</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <ul className="text-muted-foreground space-y-0.5 list-disc list-inside">
                {dataDisplay.map((item, i) => (
                  <li key={i}>{item.value}</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">Sources</p>
            <ul className="text-muted-foreground space-y-0.5 list-disc list-inside">
              {sourcesDisplay.map((src, i) => (
                <li key={i}>{src}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
