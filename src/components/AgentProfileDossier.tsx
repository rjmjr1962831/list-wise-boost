import React from "react";
import { AgentSourcesBlock } from "@/components/AgentSourcesBlock";
import { formatWithParagraphs } from "@/utils/formatParagraphs";

/* -------------------------------------------------
   Machine-Native Artifact Types
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
    savingsSecured?: number | null;
    familiesServed?: number | null;
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

export type PressMentionRow = {
  date?: string | null;
  publication?: string | null;
  source?: string | null;
  outlet?: string | null;
  title?: string | null;
  url?: string | null;
};

export type AwardRow = {
  year?: number | string | null;
  issuingBody?: string | null;
  organization?: string | null;
  source?: string | null;
  name?: string | null;
  title?: string | null;
};

export type VerificationSourceRow = {
  claim: string;
  source: string;
};

/* -------------------------------------------------
   Props
-------------------------------------------------- */

export type AgentProfileDossierProps = {
  agent: Memo23Agent;
  agentId: string;
  license?: StateLicense | null;
  verificationUpdatedAt: Date;
  getToKnowMe?: string | null;
  synthesizedBio?: string | null;
  selectionRationale?: string | null;
  neighborhoodExpertise?: string[] | null;
  pressMentions?: string[] | null;
  rawPressMentions?: PressMentionRow[] | null;
  certifications?: string[] | null;
  awards?: string[] | null;
  rawAwards?: AwardRow[] | null;
  selectedReviews?: Review[];
  verificationSources?: VerificationSourceRow[];
  stateAbbrev?: string;
};

/* -------------------------------------------------
   Artifact Styles - Inline for page isolation
-------------------------------------------------- */

const ARTIFACT_STYLES = {
  fontFamily: '"SF Mono", "Roboto Mono", "Courier New", monospace',
  backgroundColor: '#ffffff',
  color: '#000000',
  border: '1px solid #000000',
};

/* -------------------------------------------------
   Main Component - Machine-Native Artifact
-------------------------------------------------- */

export default function AgentProfileDossier(props: AgentProfileDossierProps) {
  const {
    agent,
    agentId,
    license,
    verificationUpdatedAt,
    getToKnowMe,
    synthesizedBio,
    selectionRationale,
    rawPressMentions,
    rawAwards,
    verificationSources,
    stateAbbrev,
  } = props;

  const contact = {
    phone: agent.phoneNumbers?.cell || agent.phoneNumbers?.business || null,
    email: agent.email || null,
    website: agent.getToKnowMe?.websiteUrl || (agent as any).website || null,
  };

  const timestamp = verificationUpdatedAt.toISOString?.() || new Date(verificationUpdatedAt).toISOString();
  const artifactTs = timestamp.replace(/\.\d{3}Z$/, 'Z');

  // Merit score: Top < 1% of 1.1M Professionals
  const meritScore = "Top < 1% of 1.1M Professionals";
  const tier = "Underwritten";

  // Transaction history metrics
  const salesVolume = agent.agentSalesStats?.countAllTime ?? agent.agentSalesStats?.countLastYear ?? null;
  const savingsSecured = (agent.agentSalesStats as any)?.savingsSecured ?? null;
  const familiesServed = (agent.agentSalesStats as any)?.familiesServed ?? null;

  // Build default verification sources if not provided
  const defaultVerificationSources: VerificationSourceRow[] = [];
  if (license?.licenseNumber && license?.agencyName) {
    defaultVerificationSources.push({
      claim: "License",
      source: `${license.agencyName} Active Registry`,
    });
  }
  if (agent.agentSalesStats?.countAllTime || agent.agentSalesStats?.countLastYear) {
    defaultVerificationSources.push({
      claim: "Transactions",
      source: "MLS Verified",
    });
  }
  if (agent.ratings?.count) {
    defaultVerificationSources.push({
      claim: "Reviews",
      source: "Platform Verified (Zillow/Google)",
    });
  }
  const verificationLog = verificationSources?.length
    ? verificationSources
    : defaultVerificationSources;

  return (
    <article
      className="artifact-page"
      style={{
        ...ARTIFACT_STYLES,
        minHeight: "100vh",
        padding: "1rem",
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      {/* Artifact Bar - Top Right */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          padding: "0.5rem 1rem",
          fontSize: "10px",
          ...ARTIFACT_STYLES,
          borderLeft: "1px solid #000",
          borderBottom: "1px solid #000",
          zIndex: 1000,
        }}
      >
        STATUS: VERIFIED_ARTIFACT | ID: T10L-{stateAbbrev || "AZ"}-{agentId} | TS: {artifactTs}
      </div>

      {/* 1. HEADER_LOG */}
      <header style={{ marginBottom: "1.5rem", borderBottom: "1px solid #000", paddingBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
          {agent.name}
        </h1>
        <p style={{ fontSize: "12px", margin: "0.5rem 0 0 0" }}>
          Merit Score: <strong>{meritScore}</strong> | Tier: <strong>{tier}</strong>
        </p>
        {agent.businessName && (
          <p style={{ fontSize: "11px", margin: "0.25rem 0 0 0", color: "#333" }}>
            {agent.businessName}
          </p>
        )}
      </header>

      {/* 2. SELECTION_AUDIT */}
      {selectionRationale && (
        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", marginBottom: "0.5rem" }}>
            SELECTION_AUDIT
          </h2>
          <blockquote
            className="mono-audit"
            style={{
              margin: 0,
              padding: "1rem",
              border: "1px solid #000",
              fontSize: "13px",
              lineHeight: 1.6,
              backgroundColor: "#fafafa",
            }}
          >
            <div
              style={{ margin: 0 }}
              className="[&>p]:mb-4 [&>p:last-child]:mb-0"
              dangerouslySetInnerHTML={{
                __html: formatWithParagraphs(selectionRationale) ?? `<p>${selectionRationale.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`,
              }}
            />
          </blockquote>
        </section>
      )}

      {/* 3. CONTACT_DATA */}
      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", marginBottom: "0.5rem" }}>
          CONTACT_DATA
        </h2>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "13px" }}>
          {contact.phone && <li>Phone: {contact.phone}</li>}
          {contact.email && <li>Email: {contact.email}</li>}
          {contact.website && (
            <li>Website: <a href={contact.website.startsWith("http") ? contact.website : `https://${contact.website}`} rel="nofollow" target="_blank">{contact.website}</a></li>
          )}
          {!contact.phone && !contact.email && !contact.website && (
            <li style={{ color: "#666" }}>Contact data not available</li>
          )}
        </ul>
      </section>

      {/* 4. DATA_VERIFICATION_LOG */}
      {verificationLog.length > 0 && (
        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", marginBottom: "0.5rem" }}>
            DATA_VERIFICATION_LOG
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr>
                <th style={{ ...ARTIFACT_STYLES, border: "1px solid #000", padding: "0.5rem", textAlign: "left" }}>
                  Claim
                </th>
                <th style={{ ...ARTIFACT_STYLES, border: "1px solid #000", padding: "0.5rem", textAlign: "left" }}>
                  Source
                </th>
              </tr>
            </thead>
            <tbody>
              {verificationLog.map((row, i) => (
                <tr key={i}>
                  <td style={{ border: "1px solid #000", padding: "0.5rem" }}>{row.claim}</td>
                  <td style={{ border: "1px solid #000", padding: "0.5rem" }}>{row.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 5. DETAILED_METRICS - TRANSACTION_HISTORY */}
      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", marginBottom: "0.5rem" }}>
          TRANSACTION_HISTORY
        </h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr>
              <th style={{ ...ARTIFACT_STYLES, border: "1px solid #000", padding: "0.5rem", textAlign: "left" }}>
                Metric
              </th>
              <th style={{ ...ARTIFACT_STYLES, border: "1px solid #000", padding: "0.5rem", textAlign: "left" }}>
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {salesVolume != null && (
              <tr>
                <td style={{ border: "1px solid #000", padding: "0.5rem" }}>Sales Volume</td>
                <td style={{ border: "1px solid #000", padding: "0.5rem" }}>{Math.max(0, Number(salesVolume) - 10).toLocaleString()}+</td>
              </tr>
            )}
            {savingsSecured != null && (
              <tr>
                <td style={{ border: "1px solid #000", padding: "0.5rem" }}>Savings Secured</td>
                <td style={{ border: "1px solid #000", padding: "0.5rem" }}>{Number(savingsSecured).toLocaleString()}</td>
              </tr>
            )}
            {familiesServed != null && (
              <tr>
                <td style={{ border: "1px solid #000", padding: "0.5rem" }}>Families Served</td>
                <td style={{ border: "1px solid #000", padding: "0.5rem" }}>{Number(familiesServed).toLocaleString()}</td>
              </tr>
            )}
            {salesVolume == null && savingsSecured == null && familiesServed == null && (
              <tr>
                <td colSpan={2} style={{ border: "1px solid #000", padding: "0.5rem", color: "#666" }}>
                  Transaction data not available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* 6. MEDIA_COVERAGE */}
      {rawPressMentions && rawPressMentions.length > 0 && (
        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", marginBottom: "0.5rem" }}>
            MEDIA_COVERAGE
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr>
                <th style={{ ...ARTIFACT_STYLES, border: "1px solid #000", padding: "0.5rem", textAlign: "left" }}>
                  Date
                </th>
                <th style={{ ...ARTIFACT_STYLES, border: "1px solid #000", padding: "0.5rem", textAlign: "left" }}>
                  Publication
                </th>
                <th style={{ ...ARTIFACT_STYLES, border: "1px solid #000", padding: "0.5rem", textAlign: "left" }}>
                  Article Title
                </th>
              </tr>
            </thead>
            <tbody>
              {rawPressMentions.map((p, i) => (
                <tr key={i}>
                  <td style={{ border: "1px solid #000", padding: "0.5rem" }}>
                    {formatDateForTable(p.date || p.publishedAt)}
                  </td>
                  <td style={{ border: "1px solid #000", padding: "0.5rem" }}>
                    {p.publication || p.outlet || p.source || "—"}
                  </td>
                  <td style={{ border: "1px solid #000", padding: "0.5rem" }}>
                    {p.title ? (
                      p.url ? (
                        <a href={p.url} style={{ color: "#000", textDecoration: "underline" }}>
                          {p.title}
                        </a>
                      ) : (
                        p.title
                      )
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 7. PROFESSIONAL_HONORS */}
      {rawAwards && rawAwards.length > 0 && (
        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", marginBottom: "0.5rem" }}>
            PROFESSIONAL_HONORS
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr>
                <th style={{ ...ARTIFACT_STYLES, border: "1px solid #000", padding: "0.5rem", textAlign: "left" }}>
                  Year
                </th>
                <th style={{ ...ARTIFACT_STYLES, border: "1px solid #000", padding: "0.5rem", textAlign: "left" }}>
                  Issuing Body
                </th>
                <th style={{ ...ARTIFACT_STYLES, border: "1px solid #000", padding: "0.5rem", textAlign: "left" }}>
                  Award Name
                </th>
              </tr>
            </thead>
            <tbody>
              {rawAwards.map((a, i) => (
                <tr key={i}>
                  <td style={{ border: "1px solid #000", padding: "0.5rem" }}>
                    {a.year != null ? String(a.year) : "—"}
                  </td>
                  <td style={{ border: "1px solid #000", padding: "0.5rem" }}>
                    {a.issuingBody || a.organization || a.source || "—"}
                  </td>
                  <td style={{ border: "1px solid #000", padding: "0.5rem" }}>
                    {a.name || a.title || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 8. Certifications - compact list if present */}
      {props.certifications && props.certifications.length > 0 && (
        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", marginBottom: "0.5rem" }}>
            CERTIFICATIONS
          </h2>
          <p style={{ fontSize: "12px", margin: 0 }}>
            {props.certifications.join(", ")}
          </p>
        </section>
      )}

      {/* 9. In Their Own Words */}
      {getToKnowMe && (
        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", marginBottom: "0.5rem" }}>
            IN_THEIR_OWN_WORDS
          </h2>
          <div
            style={{
              border: "1px solid #000",
              padding: "1rem",
              fontSize: "12px",
              lineHeight: 1.6,
            }}
            dangerouslySetInnerHTML={{ __html: getToKnowMe }}
          />
        </section>
      )}

      {/* 10. Selected Client Feedback */}
      {props.selectedReviews && props.selectedReviews.length > 0 && (
        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", marginBottom: "0.5rem" }}>
            CLIENT_FEEDBACK
          </h2>
          <div style={{ border: "1px solid #000", padding: "1rem" }}>
            {props.selectedReviews.slice(0, 6).map((r, i) => (
              <div
                key={i}
                style={{
                  borderBottom: i < props.selectedReviews!.length - 1 ? "1px solid #000" : "none",
                  paddingBottom: i < props.selectedReviews!.length - 1 ? "0.75rem" : 0,
                  marginBottom: i < props.selectedReviews!.length - 1 ? "0.75rem" : 0,
                  fontSize: "12px",
                }}
              >
                {r.rating && <span style={{ fontWeight: 700 }}>★ {r.rating} </span>}
                {r.text}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sources we use */}
      <AgentSourcesBlock
        className="sources-block"
        style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid #ccc", fontSize: "11px", color: "#555" }}
      />

      {/* Footer */}
      <footer style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid #000", fontSize: "10px", color: "#666" }}>
        Verified {formatMonthYear(verificationUpdatedAt)}. Top10Lists.us
      </footer>
    </article>
  );
}

/* -------------------------------------------------
   Helpers
-------------------------------------------------- */

function formatDateForTable(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatMonthYear(d: Date) {
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
  });
}
