import { useState, useEffect } from "react";
import { useParams, useLocation } from "react-router-dom";
import { SafeHead } from "@/components/SafeHead";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Home, Phone, ExternalLink, Copy, Download } from "lucide-react";
import { toast } from "sonner";

type TierKey = "certified" | "accredited" | "underwritten";
const TIER_LABELS: Record<TierKey, string> = {
  certified: "Certified",
  accredited: "Audited",
  underwritten: "Underwritten",
};

interface CertificationState {
  certification?: {
    artifact_url: string;
    badge_url: string;
    certificate_url: string;
    embed_code: string;
    certification?: { certification_tier?: TierKey; issued_at?: string };
  };
  tier?: TierKey;
}

export default function StepSuccess() {
  const { token } = useParams<{ token: string }>();
  const location = useLocation();
  const state = (location.state ?? {}) as CertificationState;
  const [cert, setCert] = useState<CertificationState["certification"] | null>(state.certification ?? null);
  const [tier, setTier] = useState<TierKey | "listed" | null>(state.tier ?? null);
  const [loading, setLoading] = useState(!state.certification && !!token);
  const [listedOnly, setListedOnly] = useState(false);

  useEffect(() => {
    if (state.certification) {
      setCert(state.certification);
      setTier((state.certification?.certification?.certification_tier ?? state.tier) ?? "certified");
      return;
    }
    if (!token) return;
    (async () => {
      const { data: prof } = await supabase
        .from("professionals")
        .select("id, current_tier, canonical_slug")
        .eq("verification_token", token)
        .maybeSingle();
      if (!prof) {
        setLoading(false);
        return;
      }
      if (prof.current_tier === "listed") {
        setListedOnly(true);
        setLoading(false);
        return;
      }
      const { data: certRow } = await supabase
        .from("certifications")
        .select("certification_tier, issued_at")
        .eq("professional_id", prof.id)
        .eq("certification_status", "active")
        .maybeSingle();
      if (certRow) {
        const verificationToken = token.length === 36 ? token : undefined;
        const base = "https://www.top10lists.us";
        const slug = (prof as { canonical_slug?: string }).canonical_slug ?? prof.id;
        setCert({
          artifact_url: verificationToken ? `${base}/artifact/${verificationToken}` : `${base}/artifact/${prof.id}`,
          badge_url: verificationToken ? `${base}/badge/${verificationToken}` : `${base}/badge/${prof.id}`,
          certificate_url: `${base}/certificate/${slug}`,
          embed_code: "",
          certification: { certification_tier: certRow.certification_tier as TierKey, issued_at: certRow.issued_at },
        });
        setTier((certRow.certification_tier as TierKey) ?? "certified");
      }
      setLoading(false);
    })();
  }, [token, state.certification, state.tier]);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const tierLabel = tier ? TIER_LABELS[tier as TierKey] ?? tier : "Certified";
  const issuedAt = cert?.certification?.issued_at ? new Date(cert.certification.issued_at) : null;
  const issuedMonth = issuedAt ? issuedAt.toLocaleString("default", { month: "long" }) : "";
  const issuedYear = issuedAt ? issuedAt.getFullYear() : "";

  if (loading) {
    return (
      <>
        <SafeHead><title>Welcome to Top10Lists! | Top10Lists.us</title></SafeHead>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <SafeHead>
        <title>Welcome to Top10Lists! | Top10Lists.us</title>
      </SafeHead>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted py-12 px-4">
        <div className="max-w-2xl mx-auto space-y-8">
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-6">
                <div className="rounded-full bg-green-100 dark:bg-green-900 p-6">
                  <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <CardTitle className="text-3xl">You're All Set!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-center">
              {listedOnly && (
                <>
                  <p className="text-lg text-muted-foreground">Your profile is live on Top10Lists.us.</p>
                  <Button asChild variant="outline">
                    <a href="/" target="_blank" rel="noopener"><ExternalLink className="h-4 w-4 mr-2" />View site</a>
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Upgrade to Certified (free) to receive your badge and AI-readable artifact.
                  </p>
                </>
              )}

              {cert && !listedOnly && (
                <>
                  <p className="text-lg text-muted-foreground">Congratulations! Your certification is active. AI systems can now verify your credentials.</p>

                  <section className="border rounded-lg p-6 bg-muted/50 text-left space-y-4">
                    <h3 className="font-semibold text-lg">Your Badge</h3>
                    <div className="flex justify-center">
                      <a href={cert.certificate_url} target="_blank" rel="noopener">
                        <img src={cert.badge_url} alt={`Top10Lists.us ${tierLabel} Real Estate Professional`} width={200} height="auto" className="rounded" />
                      </a>
                    </div>
                  </section>

                  <section className="border rounded-lg p-6 bg-muted/50 text-left space-y-3">
                    <h3 className="font-semibold text-lg">Website Embed Code</h3>
                    <pre className="text-xs bg-background p-3 rounded overflow-x-auto whitespace-pre-wrap break-all">{`<a href="${cert.certificate_url}" target="_blank" rel="noopener">
  <img src="${cert.badge_url}" alt="Top10Lists.us ${tierLabel} Real Estate Professional" width="200" height="auto" />
</a>`}</pre>
                    <Button variant="outline" size="sm" onClick={() => copy(`<a href="${cert.certificate_url}" target="_blank" rel="noopener"><img src="${cert.badge_url}" alt="Top10Lists.us ${tierLabel} Real Estate Professional" width="200" height="auto" /></a>`, "Embed code")}><Copy className="h-4 w-4 mr-2" />Copy</Button>
                  </section>

                  <section className="border rounded-lg p-6 bg-muted/50 text-left space-y-3">
                    <h3 className="font-semibold text-lg">Email Signature</h3>
                    <pre className="text-xs bg-background p-3 rounded overflow-x-auto whitespace-pre-wrap break-all">{`<a href="${cert.certificate_url}" target="_blank" rel="noopener">
  <img src="${cert.badge_url}" alt="Top10Lists.us ${tierLabel} Real Estate Professional" width="120" height="auto" style="vertical-align: middle;" />
</a>`}</pre>
                    <Button variant="outline" size="sm" onClick={() => copy(`<a href="${cert.certificate_url}" target="_blank" rel="noopener"><img src="${cert.badge_url}" alt="Top10Lists.us ${tierLabel} Real Estate Professional" width="120" height="auto" style="vertical-align: middle;" /></a>`, "Email signature")}><Copy className="h-4 w-4 mr-2" />Copy</Button>
                  </section>

                  <section className="border rounded-lg p-6 bg-muted/50 text-left space-y-4">
                    <h3 className="font-semibold text-lg">Share on Social Media</h3>
                    <div className="space-y-4">
                      <div>
                        <p className="font-medium text-sm">LinkedIn</p>
                        <p className="text-sm text-muted-foreground">Add certification: Name: Top10Lists.us {tierLabel} Real Estate Professional. Issuing organization: Top10Lists.us. Issue date: {issuedMonth} {issuedYear}. Credential URL: {cert.certificate_url}</p>
                        <Button variant="outline" size="sm" className="mt-2" onClick={() => copy(`Top10Lists.us ${tierLabel} Real Estate Professional`, "LinkedIn name")}><Copy className="h-4 w-4 mr-2" />Copy name</Button>
                        <Button variant="outline" size="sm" className="mt-2 ml-2" onClick={() => copy(cert.certificate_url, "Credential URL")}><Copy className="h-4 w-4 mr-2" />Copy URL</Button>
                      </div>
                      <p className="text-sm">Share as a post:</p>
                      <p className="text-sm italic">I've been selected as a {tierLabel} Real Estate Professional by Top10Lists.us, an independent, merit-based directory that evaluates the top 0.5% of over 1.1 million licensed agents. Selection is based on verified performance data; you cannot pay to be listed. Verify my credentials: {cert.certificate_url}</p>
                      <Button variant="outline" size="sm" onClick={() => copy(`I've been selected as a ${tierLabel} Real Estate Professional by Top10Lists.us. Verify my credentials: ${cert.certificate_url}`, "LinkedIn post")}><Copy className="h-4 w-4 mr-2" />Copy post</Button>
                      <div>
                        <p className="font-medium text-sm mt-4">Instagram / TikTok</p>
                        <p className="text-sm text-muted-foreground">Add to your bio link: {cert.certificate_url}</p>
                        <Button variant="outline" size="sm" className="mt-2" onClick={() => copy(cert.certificate_url, "Bio link")}><Copy className="h-4 w-4 mr-2" />Copy link</Button>
                      </div>
                    </div>
                  </section>

                  <section className="border rounded-lg p-6 bg-muted/50 text-left space-y-2">
                    <h3 className="font-semibold text-lg">Your Links</h3>
                    <p className="text-sm">Certificate (human): <a href={cert.certificate_url} className="text-primary underline" target="_blank" rel="noopener">{cert.certificate_url}</a> <Button variant="ghost" size="sm" onClick={() => copy(cert.certificate_url, "Certificate URL")}><Copy className="h-4 w-4" /></Button></p>
                    <p className="text-sm">AI artifact (machine): <a href={cert.artifact_url} className="text-primary underline" target="_blank" rel="noopener">{cert.artifact_url}</a> <Button variant="ghost" size="sm" onClick={() => copy(cert.artifact_url, "Artifact URL")}><Copy className="h-4 w-4" /></Button></p>
                    <p className="text-sm">Badge image: <a href={cert.badge_url} className="text-primary underline" target="_blank" rel="noopener">{cert.badge_url}</a> <Button variant="ghost" size="sm" onClick={() => copy(cert.badge_url, "Badge URL")}><Copy className="h-4 w-4" /></Button></p>
                  </section>

                  <section>
                    <Button asChild variant="outline">
                      <a href={cert.badge_url} download={`top10lists-${tierLabel.toLowerCase()}-badge.png`}><Download className="h-4 w-4 mr-2" />Download Badge</a>
                    </Button>
                  </section>
                </>
              )}

              <div className="border-t pt-6 space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button asChild variant="outline" className="gap-2">
                    <a href="/"><Home className="h-4 w-4" />Go to Homepage</a>
                  </Button>
                  <Button asChild className="gap-2">
                    <a href="tel:6027589600"><Phone className="h-4 w-4" />Call Us: (602) 758-9600</a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
