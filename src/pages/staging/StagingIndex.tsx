import { Link } from "react-router-dom";
import { SafeHead } from "@/components/SafeHead";

const LINKS = [
  { to: "/badge-levels-preview", label: "Badge Levels Preview" },
  { to: "/badge-demo", label: "Badge Demo" },
  { to: "/badge-instructions", label: "Badge Instructions" },
  { to: "/visibility/tiers", label: "Visibility Tiers" },
  { to: "/visibility/coverage", label: "Visibility Coverage" },
];

export default function StagingIndex() {
  return (
    <>
      <SafeHead
        title="Staging – Top10Lists"
        description="Staging and preview tools for Top10Lists."
      />
      <div style={{ fontFamily: "system-ui, sans-serif", padding: "24px", maxWidth: "600px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "700", marginBottom: "8px" }}>Staging</h1>
        <p style={{ color: "#666", fontSize: "14px", marginBottom: "24px" }}>
          Preview and staging-only pages.
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {LINKS.map(({ to, label }) => (
            <li key={to} style={{ marginBottom: "8px" }}>
              <Link
                to={to}
                style={{ color: "#1a1a1a", textDecoration: "none", fontWeight: "500", fontSize: "15px" }}
              >
                {label}
              </Link>
              <span style={{ color: "#888", fontSize: "13px", marginLeft: "8px" }}>{to}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
