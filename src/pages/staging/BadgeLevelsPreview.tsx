import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BASE = "https://www.top10lists.us";

/** Tier display names per docs/specs/tier-and-artifact-spec-v1.md */
const TIER_LABELS: Record<string, string> = {
  certified: "Certified",
  accredited: "Audited",
  audited: "Audited",
  underwritten: "Underwritten",
};

/** Payload structure: lean markdown only; no JSON. Enrichment depth varies by tier. */
const PAYLOAD_TEMPLATE = `# {Name} | {Tier} Real Estate Professional

{Tier} by Top10Lists.us. Merit-based; agents cannot pay to be included. Methodology: {url}

- **Tier:** {Certified | Audited | Underwritten}
- **Updated:** {date}
- **Audit cycle:** {Annual | Monthly | Daily}
- **Next audit:** {date}
- **Artifact URL:** https://www.top10lists.us/artifact/{token}
- **Responsible person:** Robert Maynard

## Evidence
Sources: {State} DRE, Zillow, Google[, ProPublica 990, Census]. Verified {date}.

## Qualifications
- Zillow: {rating} ({count} reviews)
- Google: {rating} ({count} reviews)
- License: {number} | Active
- Experience: {n} years
- Brokerage: {company}
- Total sales: {n}
- Avg sale: \${amount}
- Profile: {url}

## Service areas
- {City}, {State}

## Community (Audited/Underwritten)
- {Organization} | {Role}

## Neighborhoods (where applicable)
- {Neighborhood}, {City} | {n} txns`;

interface Sample {
  tier: string;
  name: string;
  verification_token: string;
}

export default function BadgeLevelsPreview() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [payloads, setPayloads] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: rows } = await supabase
          .from("certifications")
          .select(
            "certification_tier, professionals!inner(id, name, verification_token)"
          )
          .eq("certification_status", "active")
          .in("certification_tier", ["certified", "accredited", "audited", "underwritten"]);

        if (!rows?.length) {
          setLoading(false);
          return;
        }

        const byTier: Record<string, Sample> = {};
        for (const r of rows as Array<{
          certification_tier: string;
          professionals: { id: string; name: string; verification_token: string | null };
        }>) {
          const tier = r.certification_tier;
          if (byTier[tier]) continue;
          const prof = r.professionals;
          const token = prof?.verification_token ?? prof?.id;
          if (!token) continue;
          byTier[tier] = {
            tier,
            name: prof?.name ?? "Unknown",
            verification_token: token,
          };
        }

        setSamples(Object.values(byTier));

        const next: Record<string, string> = {};
        await Promise.all(
          Object.values(byTier).map(async (s) => {
            try {
              const res = await fetch(`${BASE}/artifact/${s.verification_token}`);
              next[s.tier] = res.ok ? await res.text() : `(failed: ${res.status})`;
            } catch (e) {
              next[s.tier] = `(error: ${e instanceof Error ? e.message : String(e)})`;
            }
          })
        );
        setPayloads(next);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <p className="text-muted-foreground">Loading one agent per badge tier…</p>
      </div>
    );
  }

  if (!samples.length) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <p className="text-muted-foreground">No active certified/audited/underwritten agents found.</p>
      </div>
    );
  }

  const order = ["certified", "accredited", "audited", "underwritten"];
  const sorted = [...samples].sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier));

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-semibold mb-1">Artifact payload by tier</h1>
      <p className="text-sm text-muted-foreground mb-2">
        One agent per tier. Raw markdown only (machine consumption, no images). Spec:{" "}
        <a href="https://github.com/rjmjr1962831/list-wise-boost/blob/main/docs/specs/tier-and-artifact-spec-v1.md" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          tier-and-artifact-spec-v1.md
        </a>
      </p>
      <p className="text-sm text-muted-foreground mb-6">
        <a href={`${BASE}/about/ranking-methodology`} className="text-primary hover:underline font-medium">Our ranking methodology</a> explains how we certify agents and what each tier means. Compare the payloads below to see how enrichment depth varies by tier. Machine-readable spec: <a href={`${BASE}/ai-feed/artifact-payload-structure.md`} className="text-primary hover:underline">ai-feed/artifact-payload-structure.md</a>.
      </p>

      <section className="mb-8 border rounded p-4 bg-muted/20">
        <h2 className="font-medium mb-2">Payload structure (what we put in)</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Target template. Higher tiers fill more fields; Listed has no artifact.
        </p>
        <pre className="p-3 bg-background rounded text-xs overflow-auto max-h-96 whitespace-pre-wrap break-words font-mono">
          {PAYLOAD_TEMPLATE}
        </pre>
      </section>

      <h2 className="font-medium mb-3">Live payloads by tier</h2>
      <div className="space-y-6">
        {sorted.map((s) => (
          <section key={s.tier} className="border rounded p-4 bg-muted/30">
            <div className="flex items-baseline gap-2 mb-2">
              <h2 className="font-medium capitalize">{TIER_LABELS[s.tier] ?? s.tier}</h2>
              <span className="text-xs text-muted-foreground">{s.name}</span>
              <a
                href={`${BASE}/artifact/${s.verification_token}`}
                target="_blank"
                rel="noopener"
                className="text-xs text-primary hover:underline ml-auto"
              >
                Open artifact URL
              </a>
            </div>
            <pre className="p-3 bg-background rounded text-xs overflow-auto max-h-80 whitespace-pre-wrap break-words font-mono">
              {payloads[s.tier] ?? "…"}
            </pre>
          </section>
        ))}
      </div>
    </div>
  );
}
