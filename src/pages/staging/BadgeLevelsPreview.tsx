import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BASE = "https://www.top10lists.us";

interface Sample {
  tier: string;
  name: string;
  verification_token: string;
  professional_id: string;
  canonical_slug: string | null;
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
            "certification_tier, professionals!inner(id, name, verification_token, canonical_slug)"
          )
          .eq("certification_status", "active")
          .in("certification_tier", ["certified", "accredited", "underwritten"]);

        if (!rows?.length) {
          setLoading(false);
          return;
        }

        const byTier: Record<string, Sample> = {};
        for (const r of rows as Array<{
          certification_tier: string;
          professionals: { id: string; name: string; verification_token: string | null; canonical_slug: string | null };
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
            professional_id: prof?.id ?? "",
            canonical_slug: prof?.canonical_slug ?? null,
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
        <p className="text-muted-foreground">Loading one agent per badge level…</p>
      </div>
    );
  }

  if (!samples.length) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <p className="text-muted-foreground">No active certified/accredited/underwritten agents found.</p>
      </div>
    );
  }

  const order = ["certified", "accredited", "underwritten"];
  const sorted = [...samples].sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier));

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Badge levels preview</h1>
      <p className="text-muted-foreground mb-6">
        One agent per tier: badge image and artifact payload.
      </p>
      <div className="space-y-8">
        {sorted.map((s) => (
          <section
            key={s.tier}
            className="border rounded-lg p-6 bg-card"
          >
            <h2 className="text-lg font-medium capitalize mb-4">{s.tier}</h2>
            <p className="text-sm text-muted-foreground mb-4">{s.name}</p>
            <div className="flex flex-wrap gap-6 items-start">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-muted-foreground">Badge</span>
                <img
                  src={`${BASE}/badge/${s.verification_token}`}
                  alt={`${s.tier} badge`}
                  className="w-32 h-auto object-contain border rounded"
                />
                <a
                  href={`${BASE}/certificate/${s.canonical_slug ?? s.professional_id}`}
                  target="_blank"
                  rel="noopener"
                  className="text-sm text-primary hover:underline"
                >
                  Certificate
                </a>
                <a
                  href={`${BASE}/artifact/${s.verification_token}`}
                  target="_blank"
                  rel="noopener"
                  className="text-sm text-primary hover:underline"
                >
                  Artifact (raw)
                </a>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-muted-foreground block mb-2">Payload (markdown)</span>
                <pre className="p-4 bg-muted rounded text-xs overflow-auto max-h-96 whitespace-pre-wrap break-words">
                  {payloads[s.tier] ?? "…"}
                </pre>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
