/**
 * Staging page: one agent per badge level (Certified, Audited, Underwritten)
 * with badge image and artifact payload side by side.
 */
import { useEffect, useState } from "react";
import { SafeHead } from "@/components/SafeHead";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const BASE = "https://www.top10lists.us";
const TIER_LABELS: Record<string, string> = {
  certified: "Certified",
  accredited: "Audited",
  underwritten: "Underwritten",
};

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
      for (const r of rows as any[]) {
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
      setSamples(
        ["certified", "accredited", "underwritten"]
          .map((t) => byTier[t])
          .filter(Boolean)
      );

      const payloadMap: Record<string, string> = {};
      for (const s of Object.values(byTier)) {
        if (!s) continue;
        try {
          const res = await fetch(
            `${BASE}/artifact/${s.verification_token}`,
            { headers: { Accept: "text/markdown" } }
          );
          const text = await res.text();
          payloadMap[s.tier] = res.ok ? text : `Error ${res.status}: ${text.slice(0, 200)}`;
        } catch (e) {
          payloadMap[s.tier] = `Failed to fetch: ${(e as Error).message}`;
        }
      }
      setPayloads(payloadMap);
    })()
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        <SafeHead>
          <title>Badge levels preview | Staging | Top10Lists.us</title>
        </SafeHead>
        <div className="min-h-screen bg-background p-8">
          <div className="max-w-6xl mx-auto space-y-8">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SafeHead>
        <title>Badge levels preview | Staging | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
      </SafeHead>
      <div className="min-h-screen bg-background p-6 md:p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <h1 className="text-2xl font-bold">Badge levels preview (staging)</h1>
            <p className="text-muted-foreground mt-1">
              One agent per certification tier: badge image and artifact payload.
            </p>
          </div>

          {samples.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground">
                  No certified agents found. Ensure there is at least one active certification per tier (certified, accredited, underwritten).
                </p>
              </CardContent>
            </Card>
          ) : (
            samples.map((s) => (
              <Card key={s.tier}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {TIER_LABELS[s.tier] ?? s.tier}
                    <span className="text-base font-normal text-muted-foreground">
                      – {s.name}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Badge</p>
                      <a
                        href={`${BASE}/certificate/${s.canonical_slug ?? s.professional_id}`}
                        target="_blank"
                        rel="noopener"
                        className="inline-block"
                      >
                        <img
                          src={`${BASE}/badge/${s.verification_token}`}
                          alt={`Top10Lists ${TIER_LABELS[s.tier]} badge`}
                          width={200}
                          height="auto"
                          className="rounded border"
                        />
                      </a>
                      <p className="text-xs text-muted-foreground mt-2">
                        Badge URL: {BASE}/badge/{s.verification_token}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Artifact payload (markdown)</p>
                      <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-[420px] whitespace-pre-wrap break-words border">
                        {payloads[s.tier] ?? "Loading…"}
                      </pre>
                      <p className="text-xs text-muted-foreground mt-2">
                        Artifact URL: {BASE}/artifact/{s.verification_token}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </>
  );
}
